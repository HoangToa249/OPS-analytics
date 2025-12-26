
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Đảm bảo đường dẫn gốc là /
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // Tăng giới hạn chunk size warning
    rollupOptions: {
      output: {
        // Code splitting tối ưu
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['chart.js', 'react-chartjs-2'],
          'utils': ['xlsx', 'html2canvas', 'jspdf'],
        },
      },
    },
  },
  server: {
    host: true
  }
})
