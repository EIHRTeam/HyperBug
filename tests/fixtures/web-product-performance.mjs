/* eslint-disable no-await-in-loop -- Isolated bounded performance samples must avoid concurrent browser load. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.HYPERBUG_PLAYWRIGHT_PATH ??
    '/Users/null/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
);
const options = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (!process.env.HYPERBUG_WEB_VITALS_PATH)
  throw new Error(
    'Provide the verified standalone web-vitals attribution build',
  );
const vitals = await readFile(process.env.HYPERBUG_WEB_VITALS_PATH, 'utf8');
const browser = await chromium.launch({
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const report = {
  profile: options.profile,
  browser: browser.version(),
  method:
    'Three sequential fresh-context cold list/detail samples and one actual Staff login followed by create/admin SPA transitions. Production build; desktop 1280x900; no CPU/network throttling; local services. Optional Chromium soft navigation attribution is feature-detected. No field percentile, hosted latency, SLO or billing claim.',
  vitals: {
    version: '6.2.3',
    sha256: createHash('sha256').update(vitals).digest('hex'),
    productionDependency: false,
  },
  samples: [],
};
async function prepare() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.addInitScript({
    content: `${vitals}\n(${instrument.toString()})();`,
  });
  const requests = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.name));
  page.on('request', (request) => {
    const url = new URL(request.url());
    assert.ok(
      [options.origin, options.apiOrigin].includes(url.origin),
      'Only owned loopback services may be requested',
    );
    requests.push({
      method: request.method(),
      kind: url.origin === options.apiOrigin ? 'api' : 'static',
      path: url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'),
    });
  });
  return { context, page, requests, errors };
}
function instrument() {
  const path = (url) =>
    new URL(url, location.origin).pathname.replace(
      /[0-9a-f]{8}-[0-9a-f-]{27}/g,
      ':id',
    );
  const target = (element) =>
    element
      ? element.tagName.toLowerCase() + (element.id ? '#' + element.id : '')
      : null;
  globalThis.lab = {
    metrics: {},
    longTasks: [],
    shifts: [],
    supported: PerformanceObserver.supportedEntryTypes,
  };
  const soft = ['soft-navigation', 'interaction-contentful-paint'].every(
    (type) => PerformanceObserver.supportedEntryTypes.includes(type),
  );
  globalThis.lab.softNavigationSupported = soft;
  const callback = (metric) => {
    const a = metric.attribution;
    globalThis.lab.metrics[metric.id] = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
      path: path(metric.navigationURL || location.href),
      attribution:
        metric.name === 'INP'
          ? {
              target: a.interactionTarget,
              inputDelay: a.inputDelay,
              processingDuration: a.processingDuration,
              presentationDelay: a.presentationDelay,
            }
          : metric.name === 'LCP'
            ? {
                target: a.element,
                timeToFirstByte: a.timeToFirstByte,
                resourceLoadDelay: a.resourceLoadDelay,
                resourceLoadDuration: a.resourceLoadDuration,
                elementRenderDelay: a.elementRenderDelay,
              }
            : {
                target: a.largestShiftTarget,
                largestShiftValue: a.largestShiftValue,
              },
    };
  };
  webVitals.onCLS(callback, { reportAllChanges: true, reportSoftNavs: soft });
  webVitals.onINP(callback, {
    reportAllChanges: true,
    reportSoftNavs: soft,
    durationThreshold: 16,
  });
  webVitals.onLCP(callback, { reportAllChanges: true, reportSoftNavs: soft });
  for (const [type, collect] of [
    [
      'longtask',
      (entry) =>
        globalThis.lab.longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
        }),
    ],
    [
      'layout-shift',
      (entry) =>
        globalThis.lab.shifts.push({
          startTime: entry.startTime,
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
          targets: (entry.sources || []).map((source) => target(source.node)),
        }),
    ],
  ])
    if (PerformanceObserver.supportedEntryTypes.includes(type))
      new PerformanceObserver((list) =>
        list.getEntries().forEach(collect),
      ).observe({ type, buffered: true });
}
async function settle(page) {
  // Fixed post-ready observation window captures deferred paints/idle INP reports.
  await page.waitForTimeout(1500);
}
async function snapshot(fixture, label, readyMs) {
  await settle(fixture.page);
  const lab = await fixture.page.evaluate(() => ({
    ...globalThis.lab,
    metrics: Object.values(globalThis.lab.metrics),
    elements: document.getElementsByTagName('*').length,
    timelineRows: document.querySelectorAll('.timeline > li').length,
  }));
  assert.deepEqual(fixture.errors, []);
  report.samples.push({
    label,
    readyMs,
    ...lab,
    requests: [...fixture.requests],
  });
}
async function cold(label, path, ready) {
  const fixture = await prepare();
  const started = performance.now();
  await fixture.page.goto(options.origin + path);
  await ready(fixture.page);
  const readyMs = performance.now() - started;
  await fixture.page.waitForFunction(() =>
    Object.values(globalThis.lab.metrics).some(
      (metric) => metric.name === 'LCP',
    ),
  );
  // Trusted interaction finalizes hard-load LCP and supplies an INP candidate.
  await fixture.page
    .getByRole('link', { name: 'Skip to content', exact: true })
    .focus();
  await fixture.page.keyboard.press('Enter');
  await snapshot(fixture, label, readyMs);
  if (label === 'detail-3') {
    const before = fixture.requests.length;
    const nextStarted = performance.now();
    await fixture.page
      .getByRole('link', { name: 'Next timeline page', exact: true })
      .click();
    await fixture.page.waitForURL((url) =>
      Boolean(url.searchParams.get('cursor')),
    );
    await fixture.page.waitForFunction(
      () => document.activeElement?.textContent === 'Discussion and timeline',
    );
    const nextReadyMs = performance.now() - nextStarted;
    const next = await fixture.page.evaluate(() => ({
      rows: document.querySelectorAll('.timeline > li').length,
      elements: document.getElementsByTagName('*').length,
    }));
    assert.ok(next.rows <= 20);
    await fixture.page
      .getByRole('link', { name: 'First page', exact: true })
      .click();
    await fixture.page.waitForURL((url) => !url.searchParams.get('cursor'));
    await fixture.page.locator('.timeline > li').nth(19).waitFor();
    report.largeDiscussion = {
      storedComments: 1000,
      windowLimit: 20,
      nextReadyMs,
      next,
      returnedRows: await fixture.page.locator('.timeline > li').count(),
      requests: fixture.requests.slice(before),
      rendering:
        'Ordinary bounded DOM, no virtualization or content-visibility',
    };
  }
  await fixture.context.close();
}
try {
  for (let sample = 1; sample <= 3; sample++) {
    await cold(
      `list-${sample}`,
      `/projects/${options.projectId}`,
      async (page) => {
        await page
          .getByRole('heading', { name: 'Product workflows', exact: true })
          .waitFor();
        await page
          .getByRole('link', { name: 'Next page', exact: true })
          .waitFor();
      },
    );
    await cold(
      `detail-${sample}`,
      `/projects/${options.projectId}/issues/${options.issue.id}/${options.issue.number}`,
      async (page) => {
        await page.locator('.timeline > li').nth(19).waitFor();
      },
    );
  }
  const fixture = await prepare();
  const { page } = fixture;
  await page.goto(options.origin + '/account');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Handle', { exact: true }).fill('rootadmin');
  await page
    .getByLabel('Password', { exact: true })
    .fill('local-browser-password-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page
    .getByRole('heading', { name: 'You are signed in.', exact: true })
    .waitFor();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByLabel('Project ID', { exact: true }).fill(options.projectId);
  await page.getByRole('link', { name: 'Open project', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Product workflows', exact: true })
    .waitFor();
  let started = performance.now();
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page
    .getByRole('button', { name: 'Create issue', exact: true })
    .waitFor();
  await page
    .getByLabel('Issue title (required)', { exact: true })
    .fill('Lab draft remains in memory');
  if (await page.evaluate(() => globalThis.lab.softNavigationSupported))
    await page.waitForFunction(() =>
      Object.values(globalThis.lab.metrics).some(
        (metric) => metric.name === 'LCP' && metric.path.endsWith('/new'),
      ),
    );
  await page.getByLabel('Issue title (required)', { exact: true }).press('End');
  await snapshot(
    fixture,
    'authenticated-create-SPA',
    performance.now() - started,
  );
  started = performance.now();
  await page.getByRole('link', { name: 'Manage project', exact: true }).click();
  if (await page.evaluate(() => globalThis.lab.softNavigationSupported))
    await page.waitForFunction(() =>
      Object.values(globalThis.lab.metrics).some(
        (metric) => metric.name === 'LCP' && metric.path.endsWith('/manage'),
      ),
    );
  await page
    .locator('summary')
    .filter({ hasText: /^Project settings$/ })
    .click();
  await page.getByLabel('Project name (required)', { exact: true }).waitFor();
  await snapshot(
    fixture,
    'authenticated-admin-SPA',
    performance.now() - started,
  );
  await fixture.context.close();
  await writeFile(
    `docs/plan/evidence/12-performance-${options.profile}.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    `Local ${options.profile} isolated performance collection passed (${report.samples.length} samples).`,
  );
} finally {
  await browser.close();
}
