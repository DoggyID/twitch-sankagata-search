import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 本番(GitHub Pages)のみ base をリポジトリ名に。ローカル開発は '/' で簡潔に
// 本番URL: https://doggyid.github.io/twitch-sankagata-search/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/twitch-sankagata-search/' : '/',
  plugins: [react()],
}));
