import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 單檔輸出：dist/index.html 內含全部 JS / CSS / 圖片；配樂放在 public/music，原樣複製到 dist/music，遊戲需要時才下載
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { chunkSizeWarningLimit: 4000 },
});
