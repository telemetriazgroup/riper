import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:9055'
  // Base path: "/" para dominio raíz (ztrack.app). "/beta_ripener/" para subpath (somos.com/beta_ripener). Definir VITE_BASE_PATH en .env si usas subpath.
  const basePath = env.VITE_BASE_PATH ?? '/'
  const base = basePath === '/' || basePath === '' ? '/' : basePath.endsWith('/') ? basePath : basePath + '/'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
    base,
    server: {
      host: '0.0.0.0',
      port: 6600,
      strictPort: false,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
