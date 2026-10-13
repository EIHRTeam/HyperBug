import { readFile, writeFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, basename } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.HYPERBUG_PLAYWRIGHT_PATH ??
    '/Users/null/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
);
const options = JSON.parse(await readFile(process.argv[2], 'utf8'));
const browser = await chromium.launch({
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.addInitScript(() => {
    globalThis.baseline = {
      lcpMs: null,
      cls: 0,
      interactions: [],
      longTasks: [],
      violations: [],
    };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        globalThis.baseline.lcpMs = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!entry.hadRecentInput) globalThis.baseline.cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (entry.interactionId)
          globalThis.baseline.interactions.push({
            id: entry.interactionId,
            durationMs: entry.duration,
          });
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        globalThis.baseline.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
    document.addEventListener('securitypolicyviolation', (event) =>
      globalThis.baseline.violations.push(event.effectiveDirective),
    );
  });
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,blink.user_timing,loading,latencyInfo',
    transferMode: 'ReturnAsStream',
  });
  await page.goto(options.localOrigin);
  await page.getByRole('heading', { name: /A shared place/ }).waitFor();
  await page.waitForTimeout(250); // One documented settling window for paint/observer delivery.
  const initial = await page.evaluate(() => ({
    ...globalThis.baseline,
    fcpMs:
      performance.getEntriesByName('first-contentful-paint')[0]?.startTime ??
      null,
    resources: performance
      .getEntriesByType('resource')
      .filter((entry) => new URL(entry.name).pathname.startsWith('/assets/'))
      .map((entry) => ({
        name: new URL(entry.name).pathname,
        bytes: entry.encodedBodySize,
      })),
  }));
  assert.ok(
    !initial.resources.some((entry) => /account-|instance-/.test(entry.name)),
  );
  await page.getByRole('link', { name: 'Instance', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Know what is available.' })
    .waitFor();
  await page.getByRole('link', { name: 'Limits', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Deployment limits', exact: true })
    .waitFor();
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Sign in to this instance.' })
    .waitFor();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByRole('heading', { name: /A shared place/ }).waitFor();
  await page.waitForTimeout(250);
  const final = await page.evaluate(() => ({
    ...globalThis.baseline,
    loadedAssets: performance
      .getEntriesByType('resource')
      .filter((entry) => new URL(entry.name).pathname.startsWith('/assets/'))
      .map((entry) => new URL(entry.name).pathname),
  }));
  assert.deepEqual(final.violations, []);
  assert.ok(
    final.loadedAssets.some((name) => /account-/.test(name)) &&
      final.loadedAssets.some((name) => /instance-/.test(name)),
  );
  const complete = new Promise((done) =>
    cdp.once('Tracing.tracingComplete', done),
  );
  await cdp.send('Tracing.end');
  const { stream } = await complete;
  const readTrace = async () => {
    const chunk = await cdp.send('IO.read', { handle: stream });
    return chunk.data + (chunk.eof ? '' : await readTrace());
  };
  const trace = await readTrace();
  await cdp.send('IO.close', { handle: stream });
  await writeFile(
    '/tmp/hyperbug-module11-public-performance-trace.json',
    trace,
  );
  const traces = JSON.parse(trace).traceEvents;
  const eventTimings = traces.filter((event) => event.name === 'EventTiming');
  const assets = await Promise.all(
    (await readdir('apps/web/dist/assets')).map(async (file) => {
      const bytes = await readFile(join('apps/web/dist/assets', file));
      return {
        file,
        bytes: bytes.length,
        gzipBytes: gzipSync(bytes).length,
        initiallyLoaded: initial.resources.some(
          (entry) => basename(entry.name) === file,
        ),
      };
    }),
  );
  const largest = assets
    .filter((asset) => asset.file.endsWith('.js'))
    .sort((a, b) => b.bytes - a.bytes)[0];
  const durations = final.interactions.map((entry) => entry.durationMs);
  const inpCandidate = durations.length ? Math.max(...durations) : null;
  const receipt = {
    environment:
      'single cold local Chrome sample, Node/PostgreSQL public instance, 1280x900, no CPU/network throttling, cache disabled; no hosted/field SLO claim',
    browser: browser.version(),
    method:
      'automated Playwright/CDP browser-performance tooling; PerformanceObserver plus DevTools timeline trace, no native computer-use',
    settlingWindowMs: 250,
    initial: { lcpMs: initial.lcpMs, fcpMs: initial.fcpMs, cls: initial.cls },
    interactionBaseline: {
      inpCandidateMs: inpCandidate,
      observedInteractions: final.interactions,
      observerFloorMs: 16,
      traceEventTimingRecords: eventTimings.length,
      caveat:
        'lab interaction sample; not a field INP percentile. Null means no interaction reached the observer floor.',
    },
    finalCls: final.cls,
    longTasksMs: final.longTasks,
    cspViolations: final.violations,
    splitting: {
      accountAndInstanceAbsentInitially: true,
      loadedOnNavigation: true,
      productionFixtureEntryAbsent: !Object.keys(
        JSON.parse(await readFile('apps/web/dist/.vite/manifest.json', 'utf8')),
      ).some((key) => key.includes('fixtures/')),
    },
    assets,
    initialJavaScriptBytes: assets
      .filter((asset) => asset.initiallyLoaded && asset.file.endsWith('.js'))
      .reduce((sum, asset) => sum + asset.bytes, 0),
    initialJavaScriptGzipBytes: assets
      .filter((asset) => asset.initiallyLoaded && asset.file.endsWith('.js'))
      .reduce((sum, asset) => sum + asset.gzipBytes, 0),
    largestJavaScriptChunk: largest,
    rawPublicTrace: 'temporary /tmp trace inspected, removed at closure',
  };
  assert.ok(initial.lcpMs !== null && initial.fcpMs !== null);
  await writeFile(
    'docs/plan/evidence/11-performance-baseline.json',
    JSON.stringify(receipt, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      lcpMs: initial.lcpMs,
      fcpMs: initial.fcpMs,
      cls: initial.cls,
      inpCandidateMs: inpCandidate,
      initialJavaScriptBytes: receipt.initialJavaScriptBytes,
      cspViolations: final.violations.length,
      splitting: true,
    }),
  );
} finally {
  await browser.close();
}
