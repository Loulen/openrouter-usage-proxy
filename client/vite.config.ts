import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Use relative paths for production builds (served by CLI)
  base: mode === 'production' ? './' : '/',
  // Define environment variables for API configuration
  define: {
    // VITE_API_URL: In production, API is on same origin (served by CLI)
    // In development, Vite proxy handles API requests
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || ''
    ),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
