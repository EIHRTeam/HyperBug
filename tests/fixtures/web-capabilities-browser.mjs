import { readFile, writeFile } from 'node:fs/promises';
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
let failure,
  stage = 'real local minimum instance';
try {
  const page = await browser.newPage();
  const paths = [],
    violations = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === options.apiOrigin) paths.push(url.pathname);
  });
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      message.text().includes('Content Security Policy')
    )
      violations.push('csp');
  });
  await page.goto(options.origin);
  await page.getByText('Cloudflare Minimum', { exact: true }).waitFor();
  assert.match(
    await page.locator('main').innerText(),
    /weaker password hashing/,
  );
  await page.getByRole('link', { name: 'Explore this instance' }).click();
  await page.getByRole('heading', { name: 'Search', exact: true }).waitFor();
  assert.match(await page.locator('main').innerText(), /titles only/);
  await page.getByRole('link', { name: 'Limits', exact: true }).click();
  assert.match(
    await page.locator('main').innerText(),
    /Cloudflare Minimum deployment/,
  );
  assert.equal(
    await page
      .locator('dt', { hasText: 'Background dispatch batch' })
      .evaluate((element) => element.nextElementSibling.textContent.trim()),
    String(options.instance.background.dispatchBatch),
  );
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await page.getByText('Passkeys are unavailable on this instance.').waitFor();
  assert.deepEqual([...new Set(paths)], ['/api/v1/instance']);
  assert.deepEqual(violations, []);
  stage = 'advertised capability removal fault injection';
  const unavailable = await browser.newPage();
  const negativePaths = [];
  unavailable.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === options.apiOrigin) negativePaths.push(url.pathname);
  });
  await unavailable.route(options.apiOrigin + '/api/v1/instance', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': options.origin },
      body: JSON.stringify({
        ...options.instance,
        authentication: {
          passwordRegistration: false,
          passwordLogin: false,
          passkeys: false,
          recoveryCodes: false,
          administratorAssistedRecovery: false,
        },
      }),
    }),
  );
  await unavailable.goto(options.origin + '/account');
  await unavailable
    .getByRole('heading', { name: 'Sign-in is unavailable', exact: true })
    .waitFor();
  assert.equal(
    await unavailable
      .getByRole('button', { name: 'Sign in', exact: true })
      .count(),
    0,
  );
  assert.deepEqual([...new Set(negativePaths)], ['/api/v1/instance']);
  stage = 'invalid capability document fails closed';
  const invalid = await browser.newPage();
  await invalid.route(options.apiOrigin + '/api/v1/instance', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': options.origin },
      body: JSON.stringify({
        ...options.instance,
        background: { ...options.instance.background, bulk: true },
      }),
    }),
  );
  await invalid.goto(options.origin + '/account');
  await invalid
    .getByRole('heading', { name: 'This instance is unavailable', exact: true })
    .waitFor();
  assert.equal(
    await invalid.getByRole('button', { name: 'Sign in', exact: true }).count(),
    0,
  );
  await writeFile(
    'docs/plan/evidence/11-capability-browser.json',
    JSON.stringify(
      {
        environment:
          'local workerd/Miniflare/D1 with actual existing Minimum fixture and real shared routes; not hosted acceptance',
        browser: browser.version(),
        realInstance: options.instance,
        realMinimumUiApplied: true,
        realApiPaths: [...new Set(paths)],
        unavailablePasskeysExplained: true,
        backgroundLimitsApplied: true,
        cspViolations: violations,
        faultInjection: {
          classification:
            'client failure-state coverage, not provider acceptance',
          allAuthenticationUnavailable: true,
          noUnavailableAuthRequests: true,
          invalidSchemaFailsClosed: true,
        },
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Actual local Minimum capability document drives the UI; unavailable/malformed variations fail safely.',
  );
} catch (error) {
  failure = `Capability browser failure at ${stage}: ${error.name}; ${error.message.split('\n')[0].replace(/https?:\/\/[^\s]+/g, '[url]')}`;
} finally {
  await browser.close();
}
if (failure) throw new Error(failure);
