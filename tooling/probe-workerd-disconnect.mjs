import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// A bare Worker isolates transport behavior from the shared Elysia application.
const script = `
let aborted = 0;
let writes = 0;
export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/counts') return Response.json({ aborted, writes });
    let heartbeat;
    let timeout;
    const cleanup = () => { clearInterval(heartbeat); clearTimeout(timeout); };
    request.signal.addEventListener('abort', () => { aborted++; cleanup(); }, { once: true });
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('ready\\n'));
        heartbeat = setInterval(() => {
          writes++;
          controller.enqueue(new TextEncoder().encode('ping\\n'));
        }, Number(url.searchParams.get('interval')));
        timeout = setTimeout(() => { cleanup(); controller.close(); }, 3000);
      },
      cancel: cleanup,
    }), { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store, no-transform' } });
  },
};
`;

const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script,
    compatibilityDate: '2026-09-16',
    compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
    unsafeDirectSockets: [{ entrypoint: 'default' }],
  }),
);
try {
  await mf.ready;
  const base = await mf.unsafeGetDirectURL();
  const counts = async () => (await fetch(new URL('/counts', base))).json();
  for (const interval of [500, 50]) {
    const before = await counts();
    const controller = new AbortController();
    const response = await fetch(new URL(`/?interval=${interval}`, base), {
      signal: controller.signal,
      headers: { 'accept-encoding': 'identity' },
    });
    const reader = response.body.getReader();
    assert.equal(
      new TextDecoder().decode((await reader.read()).value),
      'ready\n',
    );
    controller.abort();
    await assert.rejects(reader.read());
    await delay(100);
    const after100ms = await counts();
    const deadline = Date.now() + 2000;
    let after = after100ms;
    while (after.aborted === before.aborted && Date.now() < deadline) {
      await delay(20);
      after = await counts();
    }
    assert.equal(after.aborted, before.aborted + 1);
    console.log(
      JSON.stringify({ intervalMs: interval, before, after100ms, after }),
    );
  }
} finally {
  await mf.dispose();
}
