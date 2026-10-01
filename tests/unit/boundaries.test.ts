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

it('keeps the plugin contract packages on the boundary grid', () => {
  const cases = [
    {
      file: 'packages/plugin-runtime/src/boundary-fixture.ts',
      content: "import { PLUGIN_API_VERSION } from '@hyperbug/plugin-api';",
      allowed: true,
    },
    {
      file: 'packages/plugin-sdk/src/boundary-fixture.ts',
      content: "import { PLUGIN_API_VERSION } from '@hyperbug/plugin-api';",
      allowed: true,
    },
    {
      file: 'packages/plugin-api/src/boundary-fixture.ts',
      content: "import type { SomeType } from '@hyperbug/domain';",
      allowed: false,
    },
    {
      file: 'packages/plugin-sdk/src/boundary-fixture.ts',
      content: "import { createApp } from '@hyperbug/server';",
      allowed: false,
    },
    {
      file: 'packages/plugin-api/src/boundary-fixture.ts',
      content: "import { readFileSync } from 'node:fs';",
      allowed: false,
    },
  ];
  for (const item of cases) {
    try {
      writeFileSync(item.file, item.content);
      const run = () =>
        execFileSync(process.execPath, ['tooling/check-boundaries.mjs'], {
          stdio: 'pipe',
        });
      if (item.allowed) expect(run).not.toThrow();
      else expect(run).toThrow();
    } finally {
      unlinkSync(item.file);
    }
  }
});

it('permits security ports in persistence while keeping security independent of adapters', () => {
  const cases = [
    {
      file: 'packages/database/d1/src/boundary-fixture.ts',
      content: "export type { KeyRegistry } from '@hyperbug/security';",
      allowed: true,
    },
    {
      file: 'packages/database/postgres/src/boundary-fixture.ts',
      content: "export type { KeyRegistry } from '@hyperbug/security';",
      allowed: true,
    },
    {
      file: 'packages/security/src/boundary-fixture.ts',
      content: "import { createD1KeyRegistry } from '@hyperbug/database-d1';",
      allowed: false,
    },
    {
      file: 'packages/database/d1/src/boundary-fixture.ts',
      content: "import { createApp } from '@hyperbug/server';",
      allowed: false,
    },
    {
      file: 'packages/database/d1/src/boundary-fixture.ts',
      content: "export * from '../../../security/src/index.ts';",
      allowed: false,
    },
  ];
  for (const item of cases) {
    try {
      writeFileSync(item.file, item.content);
      const run = () =>
        execFileSync(process.execPath, ['tooling/check-boundaries.mjs'], {
          stdio: 'pipe',
        });
      if (item.allowed) expect(run).not.toThrow();
      else expect(run).toThrow();
    } finally {
      unlinkSync(item.file);
    }
  }
});
