/* eslint-disable no-await-in-loop -- Ordered browser transitions and scanner processing use one disposable fixture. */
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const { chromium } = await import(
  process.env.HYPERBUG_PLAYWRIGHT_PATH ??
    '/Users/null/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
);
const options = JSON.parse(await readFile(process.argv[2], 'utf8'));
const browser = await chromium.launch({
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: [
    '--host-resolver-rules=MAP media.hyperbug.test 127.0.0.1',
    `--ignore-certificate-errors-spki-list=${options.mediaSpki}`,
    '--no-proxy-server',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
let stage = 'upload browser authentication';
let latestId;
let bearer;
const checks = [];
const pageErrors = [];
const media = [];
const storageHeaders = [];
const requests = [];
const report = {
  profile: options.profile,
  browser: browser.version(),
  environment:
    options.profile === 'node'
      ? 'Disposable Node/PostgreSQL and genuine SeaweedFS 4.48 S3; actual ClamAV; production SPA'
      : 'Disposable native workerd/D1/R2 emulation with test-only loopback signer and Miniflare development CORS; actual ClamAV through private streaming binding; production SPA; not production R2 policy/signing acceptance',
  mediaTls:
    'Isolated media uses an ephemeral SPKI pin and browser-only loopback resolver rule; no system trust or DNS changes',
  scanner: options.scanner,
  browserPath: 'Browser plugin not available; existing Playwright runtime',
  checks,
  media,
  requests,
  screenshots: [],
};
page.on('pageerror', (error) => pageErrors.push(error.name));
await page.addInitScript(() => {
  globalThis.cspViolations = [];
  document.addEventListener('securitypolicyviolation', (event) =>
    globalThis.cspViolations.push(event.effectiveDirective),
  );
});
page.on('request', (request) => {
  const url = new URL(request.url());
  if (url.origin === options.storageOrigin)
    storageHeaders.push({
      authorization: Boolean(request.headers().authorization),
      cookie: Boolean(request.headers().cookie),
    });
  if (
    url.origin === options.apiOrigin &&
    /^\/api\/v1\/projects\/[^/]+\/uploads\/[0-9a-f-]{36}$/.test(url.pathname) &&
    request.method() === 'PUT'
  )
    latestId = url.pathname.split('/').at(-1);
  if (url.origin === options.mediaOrigin && request.method() === 'GET')
    bearer = request.headers().authorization;
  if (
    [options.apiOrigin, options.mediaOrigin, options.storageOrigin].includes(
      url.origin,
    )
  )
    requests.push({
      method: request.method(),
      origin:
        url.origin === options.apiOrigin
          ? 'api'
          : url.origin === options.mediaOrigin
            ? 'media'
            : 'storage',
      path: url.pathname
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id')
        .replace(/\/(staging|objects)\/[0-9a-f]{64}/g, '/$1/:key'),
    });
});
page.on('response', (response) => {
  const url = new URL(response.url());
  if (
    url.origin === options.mediaOrigin &&
    response.request().method() === 'GET' &&
    response.status() === 200
  ) {
    const headers = response.headers();
    media.push({
      type: headers['content-type'],
      disposition: headers['content-disposition']?.startsWith('attachment;'),
      nosniff: headers['x-content-type-options'],
      sandbox: headers['content-security-policy'],
      previewType: headers['x-hyperbug-preview-type'] ?? null,
    });
  }
});
async function action(operation, id = latestId) {
  const response = await fetch(
    `${options.controlOrigin}/upload/${operation}/${id}`,
    { method: 'POST' },
  );
  assert.equal(response.status, 204, `local ${operation} completed`);
}
function group() {
  return page.getByRole('group', { name: 'Screenshot', exact: true });
}
async function choose(name, mimeType, buffer) {
  await group()
    .getByLabel('Choose a file', { exact: true })
    .setInputFiles({ name, mimeType, buffer });
}
async function upload() {
  await group()
    .getByRole('button', { name: 'Upload or retry', exact: true })
    .click();
}
async function state(value) {
  await group().locator('output').filter({ hasText: value }).waitFor();
}
async function status(value) {
  await group()
    .getByRole('button', { name: 'Check processing status', exact: true })
    .click();
  await state(value);
}
async function newForm() {
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page
    .getByLabel('Submission format', { exact: true })
    .selectOption({ label: 'Detailed report' });
  await group().getByLabel('Choose a file', { exact: true }).waitFor();
}
async function submit(title) {
  await page.getByLabel('Issue title (required)', { exact: true }).fill(title);
  await page
    .getByLabel('Summary (required)', { exact: true })
    .fill('Browser upload report');
  await page
    .getByLabel('Details (required)', { exact: true })
    .fill('Released files are consumed atomically.');
  await page.getByLabel(/I checked existing reports/).check();
  await page
    .getByRole('button', { name: 'Submit Issue Form', exact: true })
    .click();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
}
async function release() {
  await action('process');
  await status('quarantined');
  await action('scan');
  await status('ready');
}
try {
  await page.goto(options.origin + '/account');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Handle', { exact: true }).fill('feedbackuser');
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
  await newForm();
  stage = 'direct upload and expired capability recovery';
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64',
  );
  let capabilityCalls = 0;
  await page.route('**/capability', async (route) => {
    capabilityCalls++;
    if (capabilityCalls !== 1) return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      json: { ...body, expiresAt: new Date(Date.now() - 1000).toISOString() },
    });
  });
  await choose('pixel.png', 'image/png', png);
  await upload();
  await state('awaiting-processing');
  assert.equal(capabilityCalls, 2);
  await page.unroute('**/capability');
  assert.equal(
    Number(await group().getByRole('progressbar').getAttribute('value')),
    png.length,
  );
  checks.push(
    'direct signed PUT uses progress and refreshes an expired returned capability once',
  );
  await release();
  await page
    .getByText('1 released file(s) selected.', { exact: true })
    .waitFor();
  checks.push(
    'actual immutable processing, quarantined/unscanned state, pinned ClamAV clean scan and separate release',
  );
  await submit('Browser released raster');
  stage = 'released raster preview and isolated download';
  await page
    .getByRole('button', { name: 'Preview image', exact: true })
    .click();
  await page.locator('img[src^="blob:"]').waitFor();
  await page.waitForFunction(
    () => document.querySelector('img[src^="blob:"]')?.naturalWidth > 0,
  );
  const rasterScreenshot = `/tmp/hyperbug12-upload-${options.profile}-raster.png`;
  await page.screenshot({ path: rasterScreenshot });
  report.screenshots.push(rasterScreenshot);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: 'Download attachment', exact: true })
      .click(),
  ]);
  assert.deepEqual(await readFile(await download.path()), png);
  checks.push(
    'released upload consumed by Issue Form, decoded raster preview and byte-exact isolated attachment download',
  );
  await newForm();
  stage = 'dangerous HTML isolated download';
  const html = Buffer.from(
    '<!doctype html><html><script>window.uploadExecuted=true</script><p>download only</p></html>',
  );
  await choose('dangerous.html', 'text/html', html);
  await upload();
  await state('awaiting-processing');
  await release();
  await submit('Browser dangerous download');
  await page
    .getByRole('button', { name: 'Preview image', exact: true })
    .click();
  await page
    .getByText(
      'Only released raster images up to 8 MiB can be previewed. Download this file to open it.',
      { exact: true },
    )
    .waitFor();
  assert.equal(await page.locator('img').count(), 0);
  const [dangerousDownload] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: 'Download attachment', exact: true })
      .click(),
  ]);
  assert.deepEqual(await readFile(await dangerousDownload.path()), html);
  assert.equal(await page.evaluate(() => globalThis.uploadExecuted), undefined);
  assert.ok(bearer);
  const isolated = await context.newPage();
  await isolated.setExtraHTTPHeaders({ authorization: bearer });
  const mediaUrl = `${options.mediaOrigin}/attachments/${latestId}`;
  const [nativeDownload] = await Promise.all([
    isolated.waitForEvent('download'),
    isolated.goto(mediaUrl).catch((error) => {
      assert.match(error.message, /download|ERR_ABORTED/i);
    }),
  ]);
  assert.deepEqual(await readFile(await nativeDownload.path()), html);
  assert.equal(
    await isolated.evaluate(() => globalThis.uploadExecuted),
    undefined,
  );
  await isolated.close();
  checks.push(
    'HTML remains octet-stream attachment under isolated sandbox CSP, cannot be raster-previewed and does not execute in SPA or media navigation',
  );
  await newForm();
  stage = 'multipart cancellation and resume';
  let multipartCapabilityCalls = 0;
  await page.route('**/multipart/parts/1/capability', async (route) => {
    multipartCapabilityCalls++;
    if (multipartCapabilityCalls !== 1) return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      json: { ...body, expiresAt: new Date(Date.now() - 1000).toISOString() },
    });
  });
  let resumePart;
  const resumed = new Promise((resolve) => {
    resumePart = resolve;
  });
  let partBlocked;
  const blocked = new Promise((resolve) => {
    partBlocked = resolve;
  });
  let paused = false;
  const parts = [];
  await page.route(options.storageOrigin + '/**', async (route) => {
    const part = new URL(route.request().url()).searchParams.get('partNumber');
    if (part) parts.push(Number(part));
    if (part === '2' && !paused) {
      paused = true;
      partBlocked();
      await resumed;
      await route.abort('aborted').catch(() => {});
      return;
    }
    await route.continue();
  });
  await choose('multipart.txt', 'text/plain', Buffer.alloc(9 * 1024 ** 2, 97));
  await upload();
  await blocked;
  const multipartId = latestId;
  const multipartScreenshot = `/tmp/hyperbug12-upload-${options.profile}-multipart.png`;
  await page.screenshot({ path: multipartScreenshot });
  report.screenshots.push(multipartScreenshot);
  assert.ok(
    Number(await group().getByRole('progressbar').getAttribute('value')) >=
      5 * 1024 ** 2,
  );
  await group()
    .getByRole('button', { name: 'Cancel upload', exact: true })
    .click();
  await state('Upload cancelled');
  resumePart();
  await upload();
  await state('awaiting-processing');
  assert.equal(latestId, multipartId);
  assert.equal(parts.filter((part) => part === 1).length, 1);
  await page.unroute(options.storageOrigin + '/**');
  await page.unroute('**/multipart/parts/1/capability');
  assert.equal(multipartCapabilityCalls, 2);
  await action('process');
  await status('quarantined');
  await action('scan');
  await status('ready');
  checks.push(
    '9 MiB multipart transfer renews an expired part capability, cancels/resumes one reservation, skips acknowledged first part and releases after actual clean scanning',
  );
  stage = 'unscannable encrypted archive';
  const encrypted = Buffer.from(
    'UEsDBAoACQAAAKEyRF2wsNcvNwAAACsAAAAJABwAY2xlYW4udHh0VVQJAAPNf8FqzX/BanV4CwABBPUBAAAEFAAAAHqQWq/aTdDdDB7rAhIP174OTTjfIkTqpqFQPO2JJZpSd9SZwJQLUTQ7W/5PglLd7vm8Fyr7GqZQSwcIsLDXLzcAAAArAAAAUEsBAh4DCgAJAAAAoTJEXbCw1y83AAAAKwAAAAkAGAAAAAAAAQAAAKSBAAAAAGNsZWFuLnR4dFVUBQADzX/BanV4CwABBPUBAAAEFAAAAFBLBQYAAAAAAQABAE8AAACKAAAAAAA=',
    'base64',
  );
  await choose('encrypted.zip', 'application/zip', encrypted);
  await upload();
  await state('awaiting-processing');
  await action('process');
  await action('scan');
  await status('quarantined');
  await state('Scan: failed');
  checks.push(
    'actual ClamAV partial result for encrypted benign archive stays quarantined and cannot be selected',
  );
  stage = 'invalid image magic and infected content';
  let rejectedSignatureCalls = 0;
  if (options.profile === 'node') {
    await page.route('**/capability', async (route) => {
      rejectedSignatureCalls++;
      if (rejectedSignatureCalls !== 1) return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      const url = new URL(body.url);
      const signature = url.searchParams.get('X-Amz-Signature');
      assert.ok(signature);
      url.searchParams.set(
        'X-Amz-Signature',
        (signature[0] === '0' ? '1' : '0') + signature.slice(1),
      );
      await route.fulfill({ response, json: { ...body, url: url.href } });
    });
  }
  await choose('invalid.png', 'image/png', Buffer.from('not a PNG'));
  await upload();
  await state('awaiting-processing');
  await action('process');
  await status('rejected');
  if (options.profile === 'node') {
    await page.unroute('**/capability');
    assert.equal(rejectedSignatureCalls, 2);
    checks.push(
      'actual S3 signature refusal returns 403 and direct transfer renews once',
    );
  }
  checks.push(
    'server immutable verification rejects declared image bytes with invalid magic',
  );
  const eicar = Buffer.from(
    [
      'X5O!P%@AP[4',
      'PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
    ].join('\\'),
  );
  await choose('scanner-test.txt', 'text/plain', eicar);
  await upload();
  await state('awaiting-processing');
  await action('process');
  await action('scan');
  await status('rejected');
  await state('Scan: infected');
  checks.push(
    'actual signed ClamAV detects EICAR and prevents file selection/release',
  );
  stage = 'expired upload reservation recovery';
  let releasePut;
  const putReleased = new Promise((resolve) => {
    releasePut = resolve;
  });
  let putBlocked;
  const putStarted = new Promise((resolve) => {
    putBlocked = resolve;
  });
  await page.route(options.storageOrigin + '/**', async (route) => {
    putBlocked();
    await putReleased;
    await route.abort('aborted').catch(() => {});
  });
  await choose('expired.txt', 'text/plain', Buffer.from('expire'));
  await upload();
  await putStarted;
  const expiredId = latestId;
  await group()
    .getByRole('button', { name: 'Cancel upload', exact: true })
    .click();
  releasePut();
  await page.unroute(options.storageOrigin + '/**');
  await action('expire', expiredId);
  await status('Upload expired');
  await upload();
  await state('awaiting-processing');
  assert.notEqual(latestId, expiredId);
  checks.push(
    'actual expired reservation is explained and retry reserves a fresh upload ID',
  );
  stage = 'empty file and authoritative quota errors';
  await choose('empty.txt', 'text/plain', Buffer.alloc(0));
  await upload();
  await state('Choose a non-empty file up to 32 MiB');
  await action('quota');
  await choose('quota.txt', 'text/plain', Buffer.from('quota'));
  await upload();
  await state('The upload quota is full');
  checks.push(
    'empty files rejected before transfer and unchanged authoritative quota exhaustion receives actionable copy',
  );
  assert.ok(storageHeaders.length > 0);
  assert.ok(
    storageHeaders.every(
      (headers) => !headers.authorization && !headers.cookie,
    ),
  );
  assert.ok(media.length >= 4);
  assert.ok(
    media.every(
      (headers) =>
        headers.type === 'application/octet-stream' &&
        headers.disposition &&
        headers.nosniff === 'nosniff' &&
        /sandbox; default-src 'none'/.test(headers.sandbox),
    ),
  );
  assert.ok(media.some((headers) => headers.previewType === 'image/png'));
  assert.ok(media.some((headers) => headers.previewType === null));
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(await page.evaluate(() => globalThis.cspViolations), []);
  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: Object.keys(sessionStorage),
  }));
  assert.equal(storage.local, 0);
  assert.ok(
    storage.session.every((key) =>
      key.startsWith('hyperbug.minimum-notice.v1:'),
    ),
  );
  report.passed = true;
  report.storageCredentialChecks = storageHeaders.length;
  report.downloadSha256 = createHash('sha256').update(html).digest('hex');
  await writeFile(
    `docs/plan/evidence/12-upload-${options.profile}.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    `Local ${options.profile} upload browser acceptance passed (${checks.length} checks).`,
  );
} catch (error) {
  await writeFile(
    `/tmp/hyperbug12-upload-${options.profile}-failure.txt`,
    await page.locator('body').innerText(),
  );
  await page.screenshot({
    path: `/tmp/hyperbug12-upload-${options.profile}-failure.png`,
  });
  console.error(
    `Upload browser failure at ${stage}: ${error.name}: ${error.message.split('\n').slice(0, 5).join(' ')}; ${error.stack?.split('\n').find((line) => line.includes('web-upload-browser')) ?? ''}`,
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
