import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

// path ที่ใช้ร่วมกันระหว่าง API และหน้าเว็บ (ตาราง 6.2.2 ของ spec ใช้ /cart, /orders, /admin/... เป็น URL ของหน้า)
// - browser เปิดหน้า (Accept: text/html) -> ให้ vite ส่ง index.html แล้ว React เลือกหน้าเอง (DC-2.12)
// - fetch จากหน้าเว็บ -> ส่งต่อไป api-server ที่พอร์ต 3000 ตามเดิม
const api: ProxyOptions = {
  target: 'http://localhost:3000',
  changeOrigin: true,
  bypass(req) {
    if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
      return '/index.html';
    }
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/login': api,
      '/me': api,
      '/list': api,
      '/cart': api,
      '/orders': api,
      '/admin': api,
    },
  },
});
