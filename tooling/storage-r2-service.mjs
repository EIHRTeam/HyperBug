import { spawn } from 'node:child_process';
if (!process.env.HYPERBUG_TEST_R2_CONFIG)
  throw new Error(
    'Set HYPERBUG_TEST_R2_CONFIG to a private ignored test-bucket JSON configuration; this command never substitutes an emulator.',
  );
const child = spawn(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    '--project',
    'node',
    'tests/node/r2-service.test.ts',
    '--reporter=verbose',
  ],
  { stdio: 'inherit', env: process.env },
);
const interrupt = () => child.kill('SIGTERM');
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
try {
  process.exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolveExit(code ?? 1));
  });
} finally {
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
}
