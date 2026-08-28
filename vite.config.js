import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// base はデプロイ先で変わるため環境変数で切り替える。
//   - ローカル開発 / Cloudflare Pages … '/'（既定）
//   - GitHub Pages …………………………… BASE_PATH=/twitch-sankagata-search/
// 本番URL: https://twitch-sankagata-search.pages.dev/
//          https://doggyid.github.io/twitch-sankagata-search/（並行運用中の旧環境）
// マルチページ構成: index.html（検索画面） + dpgk.html（DPGKモード）
export default defineConfig(() => ({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        dpgk: fileURLToPath(new URL('./dpgk.html', import.meta.url)),
      },
    },
  },
}));
