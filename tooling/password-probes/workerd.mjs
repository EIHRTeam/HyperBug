// Nonproduction research only. No audit/release/admission-control acceptance is implied.
// See docs/plan/evidence/03-password-research.md for setup, provenance and limits.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, writeFile } from 'node:fs/promises';
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

const worker = `
import factory from './factory.mjs';
import wasm from './sodium.wasm';
let loaded;
const load=()=>loaded??=factory({
 getRandomValue:()=>crypto.getRandomValues(new Uint32Array(1))[0],
 instantiateWasm(imports,receive){const instance=new WebAssembly.Instance(wasm,imports);receive(instance,wasm);return instance.exports;}
}).then(s=>{if(s._sodium_init()<0)throw new Error('sodium init failed');return s;});
export default {async fetch(request){
 const s=await load(); const params=new URL(request.url).searchParams;
 const memory=params.get('memory')==='65536'?65536:19456;
 const passes=params.get('passes')==='3'?3:2;
 const password=new TextEncoder().encode('test password'); const salt=new TextEncoder().encode('0123456789abcdef');
 const p=s._malloc(password.length),n=s._malloc(salt.length),o=s._malloc(32);
 try{
  s.HEAPU8.set(password,p);s.HEAPU8.set(salt,n);
  const started=performance.now();let timerFired=false;const timer=setTimeout(()=>{timerFired=true;},0);
  const result=s._crypto_pwhash(o,32,0,p,password.length,0,n,passes,0,memory*1024,2);
  const elapsed=performance.now()-started;clearTimeout(timer);
  const output=Array.from(s.HEAPU8.slice(o,o+32),x=>x.toString(16).padStart(2,'0')).join('');
  return Response.json({result,output,memoryKiB:memory,passes,wasmMemory:s.HEAPU8.byteLength,runtimeReportedElapsed:elapsed,timerFired,version:s.UTF8ToString(s._sodium_version_string())});
 }finally{for(const [ptr,size] of [[p,password.length],[n,salt.length],[o,32]]){s.HEAPU8.fill(0,ptr,ptr+size);s._free(ptr);}password.fill(0);salt.fill(0);}
}};`;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: [
      {
        type: 'ESModule',
        path: '.local/phase03-research/password/benchmark/worker.mjs',
        contents: worker,
      },
      {
        type: 'ESModule',
        path: '.local/phase03-research/password/benchmark/factory.mjs',
        contents: await readFile(
          new URL(
            'libsodium-sumo/package/dist/modules-sumo-esm/libsodium-sumo.mjs',
            root,
          ),
          'utf8',
        ),
      },
      {
        type: 'CompiledWasm',
        path: '.local/phase03-research/password/benchmark/sodium.wasm',
        contents: await readFile(new URL('libsodium-sumo-0.8.4.wasm', root)),
      },
    ],
    compatibilityDate: '2026-09-16',
    compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
    inspectorPort: 0,
  }),
);
try {
  const base = await mf.ready;

  const measurements = [];
  for (const [memory, passes] of [
    [19456, 2],
    [65536, 3],
  ]) {
    for (let sample = 0; sample < 5; sample++) {
      const start = performance.now();
      const response = await fetch(
        new URL('?memory=' + memory + '&passes=' + passes, base),
      );
      const data = await response.json();
      const wallMs = performance.now() - start;
      measurements.push({ sample, wallMs, ...data });
      console.log(JSON.stringify(measurements.at(-1)));
    }
  }
  const start = performance.now();
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () => fetch(base).then((r) => r.json())),
  );
  console.log(
    'eight concurrent request wallMs',
    performance.now() - start,
    'successes',
    concurrent.filter((r) => r.result === 0).length,
  );
  await writeFile(
    new URL('probe-workerd-unprofiled-result.json', root),
    JSON.stringify(
      {
        kind: 'nonproduction probe; audit provenance unresolved; no admission control',
        measurements,
        concurrency: {
          requests: 8,
          wallMs: performance.now() - start,
          successes: concurrent.filter((r) => r.result === 0).length,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await mf.dispose();
}
