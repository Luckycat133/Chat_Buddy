import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; worker-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Vite's development client uses a blob worker while reconnecting after HMR.
// Keep production/preview locked to same-origin workers, and grant blob only to
// the local development server so a source edit does not create CSP errors.
const DEVELOPMENT_SECURITY_HEADERS = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': SECURITY_HEADERS['Content-Security-Policy']
    .replace("worker-src 'self'", "worker-src 'self' blob:"),
};

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    outDir: 'dist',
    // Mermaid 11.16's optional parser is a lazy 669 kB/151 kB-gzip chunk.
    // Keep the budget just above that known boundary; all eagerly loaded
    // application chunks remain well below it.
    chunkSizeWarningLimit: 700,
    minify: 'esbuild',
    target: 'es2020',
    sourcemap: mode === 'production' ? false : true,
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
            id.includes('remark-gfm')
          ) {
            return 'vendor-markdown';
          }

          if (id.includes('rehype-katex') || id.includes('/katex/')) {
            return 'vendor-katex';
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
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    headers: DEVELOPMENT_SECURITY_HEADERS,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/proxy/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/openai/, ''),
        secure: true,
      },
      '/proxy/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/anthropic/, ''),
        secure: true,
      },
      '/proxy/xfyun': {
        target: 'https://maas-api.cn-huabei-1.xf-yun.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/xfyun/, ''),
        secure: true,
      },
      '/proxy/perplexity': {
        target: 'https://api.perplexity.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/perplexity/, ''),
        secure: true,
      },
    },
  },
  preview: {
    headers: SECURITY_HEADERS,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.4.1'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
}));
