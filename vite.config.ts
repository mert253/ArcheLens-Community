import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const publicEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const publicKey = publicEnv.VITE_SUPABASE_ANON_KEY || '';
  let privileged = publicKey.startsWith('sb_secret_');
  if (publicKey.startsWith('eyJ')) {
    try { privileged = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role !== 'anon'; }
    catch { privileged = true; }
  }
  if (privileged) throw new Error('A privileged Supabase key cannot be bundled. Use a publishable or legacy anon key.');
  return {
    server: {
      port: 3000,
      strictPort: true,
      host: '127.0.0.1',
      proxy: { '/api': { target: 'http://127.0.0.1:3002', changeOrigin: false } },
    },
    plugins: [
      react(),
      tailwindcss(),

    ],
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 8000, // suppress warning for web-llm chunk
      rollupOptions: {
        output: {
          manualChunks: {
            // Split web-llm into its own chunk so it doesn't block initial load
            'webllm': ['@mlc-ai/web-llm'],
          },
        },
      },
    },
  };
});
