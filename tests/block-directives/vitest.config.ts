import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, 'setup.ts')],
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/*.spec.ts', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      'ngx-blocks-studio': resolve(__dirname, '../../projects/blocks-studio/src/public-api.ts'),
    },
  },
});
