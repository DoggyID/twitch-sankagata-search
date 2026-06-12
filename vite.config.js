import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// 本番(GitHub Pages)のみ base をリポジトリ名に。ローカル開発は '/' で簡潔に
// 本番URL: https://doggyid.github.io/twitch-sankagata-search/
// マルチページ構成: index.html（検索画面） + dpgk.html（DPGKモード）
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/twitch-sankagata-search/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        dpgk: fileURLToPath(new URL('./dpgk.html', import.meta.url)),
      },
    },
  },
}));
