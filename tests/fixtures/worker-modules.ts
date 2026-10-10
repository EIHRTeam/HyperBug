import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function compiledWasmFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? compiledWasmFiles(path)
      : entry.isFile() && entry.name.endsWith('.wasm')
        ? [path]
        : [];
  });
}

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
export function workerModules(
  directory: string,
  wasmPaths: readonly string[] = [],
): (
  | { type: 'ESModule'; path: string }
  | { type: 'CompiledWasm'; path: string }
)[] {
  const modules = readdirSync(directory)
    .filter((name) => name.endsWith('.mjs'))
    .sort()
    .map((name) => ({
      type: 'ESModule' as const,
      path: `${directory}/${name}`,
    }));
  if (modules.length === 0)
    throw new Error(`No bundled ES modules found in ${directory}`);
  return [
    ...modules,
    ...compiledWasmFiles(directory).map((path) => ({
      type: 'CompiledWasm' as const,
      path,
    })),
    ...wasmPaths.map((path) => ({ type: 'CompiledWasm' as const, path })),
  ];
}
