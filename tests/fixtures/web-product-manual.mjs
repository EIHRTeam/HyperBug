/* eslint-disable no-await-in-loop -- Manual preparation uses the real ordered processing and scan stages. */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.HYPERBUG_PLAYWRIGHT_PATH ??
    '/Users/null/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
);
const options = JSON.parse(await readFile(process.argv[2], 'utf8'));
const browser = await chromium.launch({
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  args: [
    '--host-resolver-rules=MAP media.hyperbug.test 127.0.0.1',
    `--ignore-certificate-errors-spki-list=${options.mediaSpki}`,
    '--no-proxy-server',
  ],
});
const stop = () => {
  void browser.close();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
async function signIn(page, handle) {
  await page.goto(options.origin + '/account');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Handle', { exact: true }).fill(handle);
  await page
    .getByLabel('Password', { exact: true })
    .fill('local-browser-password-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page
    .getByRole('heading', { name: 'You are signed in.', exact: true })
    .waitFor();
}
async function openProject(page) {
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByLabel('Project ID', { exact: true }).fill(options.projectId);
  await page.getByRole('link', { name: 'Open project', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Product workflows', exact: true })
    .waitFor();
}
async function openForm(page) {
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page
    .getByLabel('Submission format', { exact: true })
    .selectOption({ label: 'Detailed report' });
  await page.getByLabel('Summary (required)', { exact: true }).waitFor();
}
try {
  const participant = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const publicPage = await participant.newPage();
  publicPage.on('pageerror', (error) =>
    console.log('Manual page error:', error.name),
  );
  await signIn(publicPage, 'feedbackuser');
  await openProject(publicPage);
  await openForm(publicPage);
  if (options.uploadLane) {
    let uploadId;
    publicPage.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.origin === options.apiOrigin &&
        request.method() === 'PUT' &&
        /\/uploads\/[0-9a-f-]{36}$/.test(url.pathname)
      )
        uploadId = url.pathname.split('/').at(-1);
    });
    const group = publicPage.getByRole('group', {
      name: 'Screenshot',
      exact: true,
    });
    await group.getByLabel('Choose a file', { exact: true }).setInputFiles({
      name: 'manual.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
    await group
      .getByRole('button', { name: 'Upload or retry', exact: true })
      .click();
    await group
      .locator('output')
      .filter({ hasText: 'awaiting-processing' })
      .waitFor();
    for (const operation of ['process', 'scan']) {
      assert.equal(
        (
          await fetch(
            `${options.controlOrigin}/upload/${operation}/${uploadId}`,
            { method: 'POST' },
          )
        ).status,
        204,
      );
    }
    console.log('Manual upload processed; checking mounted form.');
    await publicPage.screenshot({
      path: '/tmp/hyperbug12-manual-before-status.png',
    });
    await group
      .getByRole('button', { name: 'Check processing status', exact: true })
      .click();
    await group
      .locator('output')
      .filter({ hasText: 'Upload ready.' })
      .waitFor();
    await publicPage
      .getByLabel('Issue title (required)', { exact: true })
      .fill('Manual raster discussion');
    await publicPage
      .getByLabel('Summary (required)', { exact: true })
      .fill('Disposable manual accessibility fixture');
    await publicPage
      .getByLabel('Details (required)', { exact: true })
      .fill(
        'Use this discussion to check attachment controls, comments, reactions and timeline.',
      );
    await publicPage.getByLabel(/I checked existing reports/).check();
    await publicPage
      .getByRole('button', { name: 'Submit Issue Form', exact: true })
      .click();
    await publicPage
      .getByRole('heading', { name: 'Manual raster discussion', exact: true })
      .waitFor();
    assert.equal(
      (await fetch(options.controlOrigin + '/reindex', { method: 'POST' }))
        .status,
      204,
    );
    await openForm(publicPage);
  }
  const staff = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const admin = await staff.newPage();
  const cdp = await staff.newCDPSession(admin);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await signIn(admin, 'rootadmin');
  await admin
    .getByRole('button', {
      name: 'Verify a passkey for sensitive actions',
      exact: true,
    })
    .click();
  await admin
    .getByRole('button', { name: 'Register a passkey', exact: true })
    .click();
  await admin.getByText(/Passkey registered/).waitFor();
  await Promise.all([
    admin.waitForEvent('load'),
    admin.getByRole('button', { name: 'Use a passkey', exact: true }).click(),
  ]);
  await admin.getByRole('button', { name: 'Authorize', exact: true }).click();
  await admin
    .getByRole('heading', { name: 'You are signed in.', exact: true })
    .waitFor();
  await admin.route('**/api/v1/admin/plugins', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await admin.request.post(
      options.apiOrigin + '/api/v1/admin/plugins',
      {
        headers: {
          origin: options.apiOrigin,
          authorization: route.request().headers().authorization,
        },
        data: {
          manifest: {
            id: '@hyperbug/manual-fixture',
            version: '1.0.0',
            trustTier: 'trusted-native',
            apiVersion: '^1.0.0',
            capabilities: ['settings.admin'],
            extensionPoints: [],
            permissions: [],
            settings: [
              {
                key: 'caption',
                kind: 'public',
                valueType: 'string',
                defaultValue: 'Manual fixture',
              },
              { key: 'credential', kind: 'secret' },
            ],
          },
        },
      },
    );
    assert.equal(response.status(), 201);
    await route.continue();
  });
  await admin
    .getByRole('link', { name: 'Instance plugins', exact: true })
    .click();
  await admin
    .getByRole('heading', {
      name: '@hyperbug/manual-fixture · 1.0.0',
      exact: true,
    })
    .waitFor();
  await admin.unroute('**/api/v1/admin/plugins');
  await admin
    .getByRole('button', {
      name: 'Load redacted settings for @hyperbug/manual-fixture',
      exact: true,
    })
    .click();
  await admin
    .getByLabel('New secret value (write only) (required)', { exact: true })
    .waitFor();
  await openProject(admin);
  await admin
    .getByRole('link', { name: 'Manage project', exact: true })
    .click();
  console.log(
    `Manual Module 12 ready: ${options.origin}. Two disposable Chrome windows: Public User Issue Form and passkey-verified Administrator management (plugin controls available from Account). Manual observations have NOT been performed or accepted. Driver stop endpoint: ${options.controlOrigin}/manual/stop`,
  );
  await new Promise((resolve) => browser.once('disconnected', resolve));
} finally {
  await browser.close();
}
