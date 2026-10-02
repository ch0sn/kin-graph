import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Agent worktrees under .claude/ hold other checkouts of this repo.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
