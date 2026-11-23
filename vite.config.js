import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // сюда вставьте название вашего репозитория, с косой чертой с двух сторон
  base: '/ВАШЕ-НАЗВАНИЕ-РЕПО/',
})