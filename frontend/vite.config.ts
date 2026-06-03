import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'naver-map-client-id',
        transformIndexHtml(html) {
          return html.replace(
            '__NAVER_MAP_CLIENT_ID__',
            env.VITE_NAVER_MAP_CLIENT_ID ?? '',
          );
        },
      },
    ],
    resolve: {
      alias: {
        '@':       path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
  };
});
