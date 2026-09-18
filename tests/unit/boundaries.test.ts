import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

it('rejects forbidden package, relative and client imports in the real checker', () => {
  const fixture = 'packages/domain/src/forbidden.ts';
  for (const content of [
    "import type { Pool } from 'pg';",
    "export * from '../../server/src/index.ts';",
    "type Server = typeof import('@hyperbug/server');",
  ]) {
    try {
      writeFileSync(fixture, content);
      expect(() =>
        execFileSync(process.execPath, ['tooling/check-boundaries.mjs'], {
          stdio: 'pipe',
        }),
      ).toThrow();
    } finally {
      unlinkSync(fixture);
    }
  }
  expect(() =>
    execFileSync(process.execPath, ['tooling/check-boundaries.mjs'], {
      stdio: 'pipe',
    }),
  ).not.toThrow();
});
