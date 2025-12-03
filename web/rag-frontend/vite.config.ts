import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: '/RAG-UI/',
  plugins: [ 
    react(), 
    tailwindcss(),],
  server: {

    watch: {
      usePolling: true, // 使用輪詢，解決 EMFILE 或 NAS 環境監聽問題
      interval: 1000,   // 輪詢間隔 (毫秒)，可依效能需求調整
      ignored: ['**/dist/**', '**/.git/**', '**/node_modules/**']
    },

    proxy: {
      '/api': {
	target: 'http://localhost:8080',
        changeOrigin: true,
       },
     },
   },       
})
