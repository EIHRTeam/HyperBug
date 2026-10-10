import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, lstatSync } from 'node:fs';
const files = execFileSync(
  'git',
  ['ls-files', '-co', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{70,}\b/,
];
const skip = new Set(['tooling/secrets.mjs']);
let failed = false;
for (const file of files) {
  // `git ls-files -co` also reports tracked files that are deleted in the
  // working tree, which is a normal state before a commit lands.
  if (skip.has(file) || !existsSync(file) || !lstatSync(file).isFile())
    continue;
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  const lines = bytes.toString('utf8').split('\n');
  for (let line = 0; line < lines.length; line++) {
    if (patterns.some((pattern) => pattern.test(lines[line]))) {
      // Never echo a suspected secret.
      console.error(
        `${file}:${line + 1}: possible credential; remove it and rotate if live.`,
      );
      failed = true;
    }
  }
}
if (failed) process.exitCode = 1;
else console.log('Known credential signature scan passed.');
