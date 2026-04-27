import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:9055'
  const ripenerApiTarget = env.VITE_RIPENER_API_PROXY_TARGET || 'http://localhost:4000'
  const tunelApiTarget = env.VITE_TUNEL_API_PROXY_TARGET || 'http://161.132.53.51:9051'
  const maduradorDemoTarget =
    env.VITE_MADURADOR_DEMO_PROXY_TARGET || 'http://161.132.53.51:9051'
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
        '/ripener-api': {
          target: ripenerApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ripener-api/, ''),
        },
        // Mismo origen que producción bajo /madurador/ (VITE_BASE_PATH=/madurador/)
        '/madurador/ripener-api': {
          target: ripenerApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/madurador\/ripener-api/, ''),
        },
        '/tunel-api': {
          target: tunelApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/tunel-api/, ''),
        },
        // Cuenta demo: API Madurador (listar + buscar_datos). VITE_MADURADOR_DEMO_API_URL=/madurador-demo
        '/madurador-demo': {
          target: maduradorDemoTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/madurador-demo/, ''),
        },
      },
    },
  }
})
