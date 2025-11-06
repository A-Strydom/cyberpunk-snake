# Cyberpunk Snake 2077

A cyberpunk-themed Snake game built with React and HTML5 Canvas.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   The game will be available at `http://localhost:5173` (or the port shown in the terminal)

## Controls

- **Arrow Keys** or **WASD** - Move the snake
- **Space** - Pause/Resume
- **R** - Restart game
- **+/-** - Adjust game speed

## Features

- Neon cyberpunk aesthetic with glowing effects
- Particle effects and trail animations
- CRT scanlines for retro feel
- High score tracking (stored in localStorage)
- Responsive design
- Adjustable game speed

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deploy to GitHub Pages

### Option 1: Automatic Deployment (Recommended)

This project includes a GitHub Actions workflow that automatically deploys to GitHub Pages when you push to the `main` branch.

1. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - Save the changes

2. **Update the base path** (if needed):
   - The default base path is `/` which works with GitHub Actions Pages
   - If you need a custom base path, set it via environment variable: `VITE_BASE_PATH=/your-repo-name/`

3. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Setup GitHub Pages deployment"
   git push origin main
   ```

4. The workflow will automatically build and deploy your site. Check the **Actions** tab in your repository to see the deployment progress.

### Option 2: Manual Deployment

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Update the base path** for manual deployment:
   - Set the base path to match your repository name: `VITE_BASE_PATH=/your-repo-name/ npm run deploy`
   - Or update `vite.config.js` to set the base path directly

3. **Deploy:**
   ```bash
   npm run deploy
   ```

   This will build your project and push it to the `gh-pages` branch.

4. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under **Source**, select the `gh-pages` branch
   - Save the changes

Your game will be available at `https://your-username.github.io/Cyberpunk-Snake/` (or your repository URL).

