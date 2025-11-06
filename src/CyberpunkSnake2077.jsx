import React, { useEffect, useRef, useState, useMemo } from "react";

// Cyberpunk 2077–inspired Snake, drawn on an HTML <canvas>
// Controls:
//  - Arrow Keys / WASD to move
//  - Space to pause/resume
//  - R to restart
//  - +/- or slider to adjust speed
// Features: neon grid, glow, trail, particles, CRT scanlines, high score (localStorage)

const NEON = {
  bg1: "#0b0f14",
  bg2: "#0a0219",
  grid: "rgba(0, 255, 234, 0.15)",
  snake: "#00ffe6",
  snakeCore: "#62fff2",
  food: "#ff2a6d",
  foodCore: "#ff6f91",
  text: "#d7f9ff",
  accent: "#14f195",
  warn: "#ff3b3b",
};

const GRID_DEFAULT = { cols: 40, rows: 24 };

// Game speed bounds (smaller ms = faster)
const MIN_MS = 30;
const MAX_MS = 300;

// --- Utilities ---
function useDevicePixelRatio() {
  const [dpr, set] = useState(() => window.devicePixelRatio || 1);
  useEffect(() => {
    const onChange = () => set(window.devicePixelRatio || 1);
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
  }, []);
  return dpr;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function useKeyboard(onKey) {
  useEffect(() => {
    const handler = (e) => onKey?.(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);
}

// Slider mapping helpers so UI = "left slow, right fast"
function tickMsToSlider(ms) {
  // map [MIN_MS..MAX_MS] -> [MIN_MS..MAX_MS], inverted
  const v = MAX_MS + MIN_MS - ms;
  return clamp(v, MIN_MS, MAX_MS);
}
function sliderToTickMs(sliderVal) {
  const ms = MAX_MS + MIN_MS - sliderVal;
  return clamp(ms, MIN_MS, MAX_MS);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default function CyberpunkSnake2077() {
  const canvasRef = useRef(null);
  const dpr = useDevicePixelRatio();

  // UI state
  const [running, setRunning] = useState(true);
  const [tickMs, setTickMs] = useState(85); // game tick delay (ms)
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => {
    const v = localStorage.getItem("cyber_snk_high");
    return v ? parseInt(v, 10) : 0;
    // Note: if parsing fails, fallback 0
  });

  const grid = useMemo(() => GRID_DEFAULT, []);

  // Live HUD refs so the animation loop always sees latest values
  const scoreRef = useRef(0);
  const highRef = useRef(0);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { highRef.current = high; }, [high]);

  // Game state held in refs (so we can mutate inside RAF without re-render thrash)
  const stateRef = useRef({
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 10, y: 10 },
    particles: [],
    lastStep: 0,
    dead: false,
  });

  // Initialize game board dimensions responsively
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const padding = 24;
      const width = Math.min(parent.clientWidth - padding, 1000);
      const height = Math.min(parent.clientHeight - padding, 700);

      // Maintain aspect ratio of grid
      const aspect = grid.cols / grid.rows;
      let cssW = width;
      let cssH = Math.round(width / aspect);
      if (cssH > height) {
        cssH = height;
        cssW = Math.round(height * aspect);
      }

      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    };

    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvas.parentElement);
    return () => obs.disconnect();
  }, [dpr, grid.cols, grid.rows]);

  // Game initialization / reset
  const resetGame = () => {
    const midX = Math.floor(grid.cols / 3);
    const midY = Math.floor(grid.rows / 2);
    stateRef.current.snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];
    stateRef.current.dir = { x: 1, y: 0 };
    stateRef.current.nextDir = { x: 1, y: 0 };
    stateRef.current.food = spawnFood(stateRef.current.snake, grid);
    stateRef.current.dead = false;
    stateRef.current.particles = [];
    stateRef.current.lastStep = 0;
    setScore(0);
    setRunning(true);
  };

  useEffect(() => {
    resetGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard controls
  useKeyboard((e) => {
    const key = e.key.toLowerCase();
    const setDir = (x, y) => {
      // Prevent reversing on the same axis immediately
      if (x !== -stateRef.current.dir.x || y !== -stateRef.current.dir.y) {
        stateRef.current.nextDir = { x, y };
      }
    };

    if (["arrowup", "w"].includes(key)) setDir(0, -1);
    else if (["arrowdown", "s"].includes(key)) setDir(0, 1);
    else if (["arrowleft", "a"].includes(key)) setDir(-1, 0);
    else if (["arrowright", "d"].includes(key)) setDir(1, 0);
    else if (key === " ") setRunning((r) => !r);
    else if (key === "+" || key === "=") setTickMs((ms) => Math.max(MIN_MS, ms - 5));
    else if (key === "-") setTickMs((ms) => Math.min(MAX_MS, ms + 5));
    else if (key === "r") resetGame();
  });

  // Game loop
  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const cellW = () => canvas.width / grid.cols;
    const cellH = () => canvas.height / grid.rows;

    const step = (ts) => {
      if (!stateRef.current.lastStep) stateRef.current.lastStep = ts;
      const elapsed = ts - stateRef.current.lastStep;

      drawBackground(ctx, canvas);
      drawGrid(ctx, canvas, grid);

      if (!stateRef.current.dead && running && elapsed >= tickMs) {
        logicStep(grid);
        stateRef.current.lastStep = ts;
      }

      drawFood(ctx, cellW(), cellH());
      drawSnake(ctx, cellW(), cellH());
      drawParticles(ctx);
      drawHUD(ctx, canvas);

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [grid, running, tickMs]);

  // --- Game helpers ---
  function logicStep(grid) {
    const st = stateRef.current;
    st.dir = st.nextDir; // commit input
    const head = st.snake[0];
    const nx = head.x + st.dir.x;
    const ny = head.y + st.dir.y;

    // Wrap-around walls (feels more futuristic)
    const hx = (nx + grid.cols) % grid.cols;
    const hy = (ny + grid.rows) % grid.rows;

    const newHead = { x: hx, y: hy };

    // Self collision
    if (st.snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      st.dead = true;
      setRunning(false);
      setHigh((h) => {
        const nh = Math.max(h, scoreRef.current);
        localStorage.setItem("cyber_snk_high", String(nh));
        return nh;
      });
      burstParticles(newHead, 20);
      return;
    }

    st.snake.unshift(newHead);

    // Eat food
    if (newHead.x === st.food.x && newHead.y === st.food.y) {
      setScore((s) => {
        const ns = s + 10;
        if (ns > highRef.current) {
          localStorage.setItem("cyber_snk_high", String(ns));
          setHigh(ns);
        }
        return ns;
      });
      st.food = spawnFood(st.snake, grid);
      burstParticles(newHead, 12);
    } else {
      st.snake.pop(); // move forward
    }

    // Trail particles
    st.particles.push({
      x: newHead.x + 0.5 + (Math.random() - 0.5) * 0.25,
      y: newHead.y + 0.5 + (Math.random() - 0.5) * 0.25,
      life: 1,
      dx: (Math.random() - 0.5) * 0.02,
      dy: (Math.random() - 0.5) * 0.02,
      color: NEON.snake,
    });

    // Keep particle count sane
    if (st.particles.length > 400) st.particles.splice(0, st.particles.length - 400);
  }

  function spawnFood(snake, grid) {
    let x, y;
    do {
      x = randInt(0, grid.cols - 1);
      y = randInt(0, grid.rows - 1);
    } while (snake.some((s) => s.x === x && s.y === y));
    return { x, y };
  }

  function gridToPx(x, y, cw, ch) {
    const px = x * cw;
    const py = y * ch;
    return [px, py, cw, ch];
  }

  function burstParticles(cell, n = 10) {
    const st = stateRef.current;
    for (let i = 0; i < n; i++) {
      st.particles.push({
        x: cell.x + 0.5,
        y: cell.y + 0.5,
        life: 1,
        dx: (Math.random() - 0.5) * 0.08,
        dy: (Math.random() - 0.5) * 0.08,
        color: Math.random() > 0.5 ? NEON.food : NEON.accent,
      });
    }
  }

  // --- Drawing ---
  function drawBackground(ctx, canvas) {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, NEON.bg1);
    g.addColorStop(1, NEON.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vignette
    const rad = Math.max(canvas.width, canvas.height) * 0.8;
    const vg = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      rad * 0.25,
      canvas.width / 2,
      canvas.height / 2,
      rad
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // CRT scanlines
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#000";
    const spacing = 3 * (window.devicePixelRatio || 1);
    for (let y = 0; y < canvas.height; y += spacing) {
      ctx.fillRect(0, y, canvas.width, 1);
    }
    ctx.restore();
  }

  function drawGrid(ctx, canvas, grid) {
    ctx.save();
    ctx.strokeStyle = NEON.grid;
    ctx.lineWidth = 1;
    ctx.shadowColor = NEON.grid;
    ctx.shadowBlur = 6;

    const cw = canvas.width / grid.cols;
    const ch = canvas.height / grid.rows;

    // Outer frame
    ctx.strokeStyle = "rgba(0,255,234,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    ctx.lineWidth = 1;
    ctx.strokeStyle = NEON.grid;

    for (let x = 1; x < grid.cols; x++) {
      const px = Math.round(x * cw) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();
    }
    for (let y = 1; y < grid.rows; y++) {
      const py = Math.round(y * ch) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(canvas.width, py);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSnake(ctx, cw, ch) {
    const st = stateRef.current;

    // Glow trail
    ctx.save();
    ctx.shadowColor = NEON.snake;
    ctx.shadowBlur = 18;

    st.snake.forEach((seg, i) => {
      const [x, y, w, h] = gridToPx(seg.x, seg.y, cw, ch);
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, NEON.snake);
      g.addColorStop(1, NEON.snakeCore);
      ctx.fillStyle = g;

      // Rounded rectangle cell
      const r = Math.min(w, h) * 0.25;
      roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
      ctx.fill();

      // Head accent
      if (i === 0) {
        ctx.save();
        ctx.fillStyle = "#0b0f14";
        ctx.globalAlpha = 0.15;
        roundRect(ctx, x + w * 0.15, y + h * 0.15, w * 0.7, h * 0.7, r * 0.6);
        ctx.fill();
        ctx.restore();
      }
    });
    ctx.restore();
  }

  function drawFood(ctx, cw, ch) {
    const st = stateRef.current;
    const [x, y, w, h] = gridToPx(st.food.x, st.food.y, cw, ch);

    ctx.save();
    ctx.shadowColor = NEON.food;
    ctx.shadowBlur = 24;

    const g = ctx.createRadialGradient(
      x + w / 2,
      y + h / 2,
      Math.min(w, h) * 0.1,
      x + w / 2,
      y + h / 2,
      Math.max(w, h) * 0.6
    );
    g.addColorStop(0, NEON.foodCore);
    g.addColorStop(1, NEON.food);
    ctx.fillStyle = g;

    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.min(w, h) * 0.35);
    ctx.fill();

    ctx.restore();
  }

  function drawParticles(ctx) {
    const st = stateRef.current;
    const canvas = canvasRef.current;
    const cw = canvas.width / grid.cols;
    const ch = canvas.height / grid.rows;

    for (let i = st.particles.length - 1; i >= 0; i--) {
      const p = st.particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.life -= 0.02;
      if (p.life <= 0) {
        st.particles.splice(i, 1);
        continue;
      }
      const [x, y] = gridToPx(p.x, p.y, cw, ch);
      const size = Math.max(1, Math.min(cw, ch) * 0.15);
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHUD(ctx, canvas) {
    const pad = 16 * (window.devicePixelRatio || 1);
    ctx.save();
    ctx.font = `${14 * (window.devicePixelRatio || 1)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
    ctx.textBaseline = "top";
    ctx.shadowColor = NEON.accent;
    ctx.shadowBlur = 12;

    // Score (live via refs)
    ctx.fillStyle = NEON.text;
    ctx.fillText(`SCORE ${scoreRef.current.toString().padStart(4, "0")}`, pad, pad);

    // High score (live via refs)
    const txt = `HIGH ${highRef.current.toString().padStart(4, "0")}`;
    const m = ctx.measureText(txt);
    ctx.fillText(txt, canvas.width - pad - m.width, pad);

    // Status
    if (!running) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.fillStyle = stateRef.current.dead ? NEON.warn : NEON.text;
      ctx.shadowColor = stateRef.current.dead ? NEON.warn : NEON.accent;
      ctx.shadowBlur = 18;
      ctx.font = `${Math.floor(canvas.width * 0.04)}px Orbitron, Oxanium, ui-sans-serif, system-ui`;
      ctx.fillText(stateRef.current.dead ? "SYSTEM FAILURE" : "PAUSED", cx, cy - 20);

      ctx.shadowBlur = 6;
      // Use monospace HUD font (preferred look for pause instructions)
      ctx.font = `${Math.floor(canvas.width * 0.018)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
      ctx.fillStyle = NEON.text;
      ctx.globalAlpha = 0.9;
      ctx.fillText("Press R to Reboot • Space to Resume", cx, cy + 40);
    }

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  // --- Render ---
  return (
    <div className="min-h-screen w-full bg-[#070911] text-white relative flex flex-col items-center justify-start p-6">
      {/* Neon header */}
      <div className="w-full max-w-5xl mb-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-wide">
            <span className="[text-shadow:0_0_10px_rgba(0,255,234,0.8)] text-cyan-300">CYBER</span>
            <span className="ml-1 [text-shadow:0_0_10px_rgba(255,42,109,0.8)] text-pink-400">SNAKE</span>
            <span className="ml-2 text-xs md:text-sm text-cyan-200/70">v2077</span>
          </h1>
          <div className="flex items-center gap-3 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-cyan-200/80">Speed</span>
              <input
                aria-label="speed"
                type="range"
                min={MIN_MS}
                max={MAX_MS}
                value={tickMsToSlider(tickMs)}
                onChange={(e) => setTickMs(sliderToTickMs(parseInt(e.target.value, 10)))}
                className="accent-cyan-300 cursor-pointer"
              />
              <span className="tabular-nums text-cyan-200/60">{tickMs}ms</span>
            </div>
            <button
              onClick={() => setRunning((r) => !r)}
              className="px-3 py-1 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-300/30 shadow-[0_0_12px_rgba(0,255,234,0.3)]"
            >
              {running ? "Pause" : "Resume"}
            </button>
            <button
              onClick={resetGame}
              className="px-3 py-1 rounded-2xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-400/30 shadow-[0_0_12px_rgba(255,42,109,0.35)]"
            >
              Reboot
            </button>
          </div>
        </div>
      </div>

      {/* Canvas container */}
      <div className="relative w-full max-w-5xl aspect-[5/3] rounded-2xl overflow-hidden border border-cyan-400/20 shadow-[0_0_40px_rgba(0,255,234,0.25)]">
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Decorative corner brackets */}
        <div className="pointer-events-none absolute inset-0">
          {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-10 h-10 opacity-60`}>
              <div className="absolute inset-x-0 top-0 h-[2px] bg-cyan-300/60" />
              <div className="absolute inset-y-0 left-0 w-[2px] bg-cyan-300/60" />
            </div>
          ))}
        </div>
      </div>

      {/* Help footer */}
      <div className="mt-4 text-cyan-200/80 text-xs md:text-sm">
        <p className="text-center">
          Controls: <span className="text-cyan-300">WASD/Arrows</span> to move • <span className="text-cyan-300">Space</span> to pause • <span className="text-cyan-300">R</span> to reboot • <span className="text-cyan-300">+/−</span> to tweak speed
        </p>
      </div>
    </div>
  );
}

// --- "Test cases" (runtime assertions for key helpers; no user-facing UI change) ---
// These run once in the browser and help catch mapping bugs during development.
(function devTests(){
  try {
    console.assert(tickMsToSlider(MIN_MS) === MAX_MS, "MIN_MS should map to rightmost (fastest)");
    console.assert(tickMsToSlider(MAX_MS) === MIN_MS, "MAX_MS should map to leftmost (slowest)");
    console.assert(sliderToTickMs(MIN_MS) === MAX_MS, "Leftmost slider should map to slowest tick (MAX_MS)");
    console.assert(sliderToTickMs(MAX_MS) === MIN_MS, "Rightmost slider should map to fastest tick (MIN_MS)");

    const mid = Math.round((MIN_MS + MAX_MS) / 2);
    console.assert(sliderToTickMs(tickMsToSlider(mid)) === mid, "Slider<->tick mapping should be inverse at midpoint");
  } catch (e) {
    // Swallow to avoid breaking app in production, but log for dev visibility
    console.warn("Dev test failed:", e);
  }
})();

