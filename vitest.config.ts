import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    projects: [
      'unit',
      'contract',
      'node',
      'workerd',
      'postgres',
      'scanner',
    ].map((name) => ({
      test: {
        name,
        include: [`tests/${name}/**/*.test.ts`],
        environment: 'node',
        testTimeout: name === 'scanner' ? 75000 : 15000,
        hookTimeout: name === 'scanner' ? 45000 : 30000,
        fileParallelism: false,
      },
    })),
  },
});
