import { readdirSync } from 'node:fs';

/**
 * Every emitted ES module of a workerd bundle, for Miniflare's `modules`.
 *
 * A bundled Worker entry is not necessarily one file: `apps/api-cloudflare`
 * keeps rolldown's default code splitting and emits content-hashed chunks.
 * Declaring only the entry makes workerd fail at startup with
 * `No such module "dist/<chunk>.mjs"`, so each lane passes the whole directory
 * instead of naming files. Filenames are content-addressed and therefore
 * deliberately not asserted.
 */
export function workerModules(directory: string): {
  type: 'ESModule';
  path: string;
}[] {
  const modules = readdirSync(directory)
    .filter((name) => name.endsWith('.mjs'))
    .sort()
    .map((name) => ({
      type: 'ESModule' as const,
      path: `${directory}/${name}`,
    }));
  if (modules.length === 0)
    throw new Error(`No bundled ES modules found in ${directory}`);
  return modules;
}
