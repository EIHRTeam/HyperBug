import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    projects: ['unit', 'contract', 'node', 'workerd', 'postgres'].map(
      (name) => ({
        test: {
          name,
          include: [`tests/${name}/**/*.test.ts`],
          environment: 'node',
          testTimeout: 15000,
          hookTimeout: 30000,
          fileParallelism: false,
        },
      }),
    ),
  },
});
