import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // <-- add this alias
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:49251',  // your backend server
    },
  },
});
