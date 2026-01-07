import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', '**/*.test.ts', '**/__tests__/**'],
    },
    include: ['src/**/*.test.ts'],
  },
});
