import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// For GitHub Actions Pages deployment: base should be '/'
// For manual gh-pages deployment: base should be '/your-repo-name/'
// You can override with VITE_BASE_PATH environment variable
const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base: base,
})

