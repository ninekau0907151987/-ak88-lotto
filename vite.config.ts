import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      allowedHosts: true,
      // ★ ปิด HMR สนิทเมื่อสั่ง DISABLE_HMR=true
      //   ต้องเป็น false (ไม่ใช่ undefined) ไม่งั้น Vite จะยังเปิด WebSocket
      //   ที่ port 24678 ซึ่งชนกับ server อื่น → middleware ค้าง ตอบไม่กลับ
      hmr: process.env.DISABLE_HMR === 'true' ? false : true,
      // ★ ปิด file watching ด้วยเมื่อไม่ใช้ HMR
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
