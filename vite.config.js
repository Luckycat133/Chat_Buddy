import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('/react/') || id.includes('react-dom') || id.includes('scheduler')) {
            return 'vendor-react';
          }

          if (id.includes('react-router')) {
            return 'vendor-router';
          }

          if (
            id.includes('react-markdown') ||
            id.includes('remark-gfm') ||
            id.includes('rehype-katex') ||
            id.includes('/katex/')
          ) {
            return 'vendor-markdown';
          }

          if (
            id.includes('react-syntax-highlighter') ||
            id.includes('prismjs') ||
            id.includes('refractor')
          ) {
            return 'vendor-highlight';
          }

          if (id.includes('@dnd-kit')) {
            return 'vendor-dnd';
          }

          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }

          if (id.includes('mathjs')) {
            return 'vendor-math';
          }
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://maas-api.cn-huabei-1.xf-yun.com/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
      }
    }
  }
})
