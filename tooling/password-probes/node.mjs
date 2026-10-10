// Nonproduction research only. No audit/release/admission-control acceptance is implied.
// See docs/plan/evidence/03-password-research.md for setup, provenance and limits.
import { readFile, writeFile } from 'node:fs/promises';
import { argon2Sync } from 'node:crypto';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';
const root = pathToFileURL(
  resolvePath('.local/phase03-research/password') + '/',
);
const manifest = JSON.parse(
  await readFile(
    'docs/plan/evidence/03-password-probe-provenance.json',
    'utf8',
  ),
);
for (const [path, expected] of [
  [
    'libsodium-sumo/package/dist/modules-sumo-esm/libsodium-sumo.mjs',
    manifest.factorySha256,
  ],
  ['libsodium-sumo-0.8.4.wasm', manifest.wasmSha256],
]) {
  const bytes = await readFile(new URL(path, root));
  if (createHash('sha256').update(bytes).digest('hex') !== expected)
    throw new Error('Password probe artifact integrity mismatch');
}

const { default: factory } = await import(
  new URL(
    'libsodium-sumo/package/dist/modules-sumo-esm/libsodium-sumo.mjs',
    root,
  )
);
const wasm = await WebAssembly.compile(
  await readFile(new URL('libsodium-sumo-0.8.4.wasm', root)),
);
const sodium = await factory({
  getRandomValue: () => crypto.getRandomValues(new Uint32Array(1))[0],
  instantiateWasm(imports, receive) {
    const instance = new WebAssembly.Instance(wasm, imports);
    receive(instance, wasm);
    return instance.exports;
  },
});
// eslint-disable-next-line no-underscore-dangle -- Upstream Emscripten ABI name.
if (sodium._sodium_init() !== 0) throw new Error('initialization failed');
const password = new TextEncoder().encode('test password'),
  salt = new TextEncoder().encode('0123456789abcdef');
const measurements = [];
for (const [memoryKiB, passes] of [
  [19456, 2],
  [65536, 3],
]) {
  const native = argon2Sync('argon2id', {
    message: password,
    nonce: salt,
    parallelism: 1,
    tagLength: 32,
    memory: memoryKiB,
    passes,
  }).toString('hex');
  for (let sample = 0; sample < 5; sample++) {
    // eslint-disable-next-line no-underscore-dangle -- Upstream Emscripten ABI name.
    const p = sodium._malloc(password.length),
      // eslint-disable-next-line no-underscore-dangle -- Upstream Emscripten ABI name.
      s = sodium._malloc(salt.length),
      // eslint-disable-next-line no-underscore-dangle -- Upstream Emscripten ABI name.
      o = sodium._malloc(32);
    try {
      sodium.HEAPU8.set(password, p);
      sodium.HEAPU8.set(salt, s);
      const start = performance.now(),
        cpuStart = process.cpuUsage();
      // eslint-disable-next-line no-underscore-dangle -- Upstream Emscripten ABI name.
      const result = sodium._crypto_pwhash(
        o,
        32,
        0,
        p,
        password.length,
        0,
        s,
        passes,
        0,
        memoryKiB * 1024,
        2,
      );
      const cpu = process.cpuUsage(cpuStart),
        wallMs = performance.now() - start;
      const output = Buffer.from(sodium.HEAPU8.slice(o, o + 32)).toString(
        'hex',
      );
      if (result !== 0 || output !== native)
        throw new Error('Cross-implementation mismatch');
      measurements.push({
        sample,
        result,
        memoryKiB,
        passes,
        wallMs,
        cpuMs: (cpu.user + cpu.system) / 1000,
        wasmMemory: sodium.HEAPU8.byteLength,
        processMemory: process.memoryUsage(),
        output,
        nativeMatch: true,
      });
    } finally {
      for (const [ptr, size] of [
        [p, password.length],
        [s, salt.length],
        [o, 32],
      ]) {
        sodium.HEAPU8.fill(0, ptr, ptr + size);
        // eslint-disable-next-line no-underscore-dangle -- Upstream Emscripten ABI name.
        sodium._free(ptr);
      }
    }
  }
}
await writeFile(
  new URL('probe-node-result.json', root),
  JSON.stringify(
    {
      kind: 'nonproduction probe; audit provenance unresolved; synchronous WASM binding',
      // eslint-disable-next-line no-underscore-dangle -- Upstream Emscripten ABI name.
      version: sodium.UTF8ToString(sodium._sodium_version_string()),
      node: process.version,
      measurements,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    measurements.map(
      ({ memoryKiB, passes, wallMs, cpuMs, wasmMemory, nativeMatch }) => ({
        memoryKiB,
        passes,
        wallMs,
        cpuMs,
        wasmMemory,
        nativeMatch,
      }),
    ),
    null,
    2,
  ),
);
