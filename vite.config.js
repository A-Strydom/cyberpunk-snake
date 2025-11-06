import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// For GitHub Pages deployment with repo name subdirectory
// Override with VITE_BASE_PATH environment variable if needed
const base = process.env.VITE_BASE_PATH || '/cyberpunk-snake/'

export default defineConfig({
  plugins: [react()],
  base: base,
})

