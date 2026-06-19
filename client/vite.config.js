import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'esnext',
    // Vite 8 uses OXC (Oxidized) as the default minifier via rolldown
    minify: 'oxc',
    sourcemap: false,
    outDir: 'dist',
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
})
