import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configuredApiUrl = env.VITE_API_URL?.trim()
  const apiUrl = configuredApiUrl || (mode === 'development' ? 'http://127.0.0.1:8000/api/v1' : '')

  if (!apiUrl) {
    throw new Error('VITE_API_URL must be configured for non-development builds.')
  }

  if (mode === 'development' && /https?:\/\/(?:www\.)?sounditent\.(?:com|cn)/i.test(apiUrl)) {
    throw new Error('Local development cannot target Sound It production. Set VITE_API_URL to an isolated local or staging API.')
  }

  return {
    base: '/',
    plugins: [inspectAttr(), react()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React framework
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // UI & animation libraries
            'ui-vendor': ['framer-motion', 'lucide-react', 'sonner'],
            // Data visualization & 3D (heavy)
            'viz-3d': ['recharts', 'three', '@react-three/fiber', '@react-three/drei'],
            // Admin dashboard pages (heavy, rarely visited)
            'admin-vendor': ['@supabase/supabase-js'],
          },
        },
      },
    },
  },
  }
});
