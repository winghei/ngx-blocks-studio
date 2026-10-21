import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const libRoot = resolve(__dirname, '../../projects/blocks-studio/src/lib');

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, 'setup.ts')],
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: resolve(__dirname, '../../coverage/block-directives'),
      include: [`${libRoot}/**/*.ts`],
      exclude: [
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/*.types.ts',
        '**/index.ts',
      ],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportOnFailure: true,
    },
  },
  resolve: {
    alias: {
      'ngx-blocks-studio': resolve(__dirname, '../../projects/blocks-studio/src/public-api.ts'),
    },
  },
});
