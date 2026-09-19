import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

// `.oxlintrc.json` and the hand-written checker in `tooling/check-boundaries.mjs`
// split the import-boundary policy: oxlint owns syntax-level rules and the
// script owns package-manifest and path-resolution rules. `tests/unit/boundaries.test.ts`
// proves the script. This test proves oxlint, which matters because oxlint does
// not validate rule options at runtime: a misspelled option key silently reports
// zero findings and exits 0, so a broken configuration would pass CI.
const fixture = 'packages/domain/src/forbidden.ts';
const cases = [
  {
    content: "import { createApp } from '@hyperbug/server';",
    expected: 'no-restricted-imports',
  },
  {
    content: "export * from '../../server/src/index.ts';",
    expected: 'no-restricted-imports',
  },
  {
    content: "import { strict } from '@hyperbug/domain/strict';",
    expected: 'no-restricted-imports',
  },
  {
    content: "import { local } from './local';",
    expected: 'import(extensions)',
  },
];

function lint(file: string): { failed: boolean; output: string } {
  try {
    const stdout = execFileSync(
      process.execPath,
      ['node_modules/oxlint/bin/oxlint', file],
      { stdio: 'pipe' },
    );
    return { failed: false, output: stdout.toString() };
  } catch (error) {
    const stdout = (error as { stdout?: Buffer }).stdout?.toString() ?? '';
    return { failed: true, output: stdout };
  }
}

it('enforces import boundaries and extensions through the oxlint configuration', () => {
  for (const { content, expected } of cases) {
    let result: { failed: boolean; output: string };
    try {
      writeFileSync(fixture, content);
      result = lint(fixture);
    } finally {
      unlinkSync(fixture);
    }
    expect(result.failed, `${content} must be rejected`).toBe(true);
    expect(result.output, `${content} must report ${expected}`).toContain(
      expected,
    );
  }
});
