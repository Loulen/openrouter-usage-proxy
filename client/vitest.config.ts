import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/__tests__/setup.ts',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', '**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
