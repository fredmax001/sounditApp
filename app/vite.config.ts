import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [inspectAttr(), react()],
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
});
