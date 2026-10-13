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
  args: ['--no-proxy-server', '--host-resolver-rules=MAP *.test 127.0.0.1'],
});
let failure,
  stage = 'real fixture login';
try {
  const page = await browser.newPage();
  const tokens = [];
  page.on('response', async (response) => {
    if (
      response.url() === options.authOrigin + '/auth/token' &&
      response.status() === 200
    )
      tokens.push((await response.json()).accessToken);
  });
  const field = page.getByLabel('Draft title (required)', { exact: true });
  const login = async (handle, kind) => {
    await page.goto(options.uiOrigin);
    await page
      .getByRole('button', { name: 'Fixture sign in', exact: true })
      .click();
    if (handle) {
      await page.getByLabel('Handle', { exact: true }).fill(handle);
      await page
        .getByLabel('Password', { exact: true })
        .fill('operator-password-1');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    } else
      await page
        .getByRole('button', { name: 'Authorize', exact: true })
        .click();
    await page.getByTestId('account-kind').filter({ hasText: kind }).waitFor();
  };
  const seedDraft = async (value) => {
    await field.fill(value);
    await page
      .getByRole('button', { name: 'Seed private cache', exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid=cache-count]')
        .textContent.trim()
        .endsWith('1'),
    );
    assert.match(
      (await page.getByTestId('cache-count').innerText()).trim(),
      /1$/,
    );
  };
  const assertCleared = async () => {
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid=account-kind]').textContent ===
        'Signed out',
    );
    assert.equal(await field.inputValue(), '');
    assert.match(
      (await page.getByTestId('cache-count').innerText()).trim(),
      /0$/,
    );
    assert.deepEqual(
      await page.evaluate(async () => ({
        local: localStorage.length,
        session: sessionStorage.length,
        caches: (await caches.keys()).length,
      })),
      { local: 0, session: 0, caches: 0 },
    );
  };
  await login('rootadmin', 'Staff');
  await seedDraft('principal A private draft');
  stage = 'logout clears private cache and draft';
  const revoke = page.waitForResponse(
    (response) =>
      response.url().endsWith('/auth/token/revoke') &&
      response.status() === 204,
  );
  await page
    .getByRole('button', { name: 'Clear session', exact: true })
    .click();
  await revoke;
  await assertCleared();
  stage = 'different principal starts empty';
  const registration = await page.evaluate(
    async (origin) =>
      (
        await fetch(origin + '/api/v1/accounts/register', {
          method: 'POST',
          credentials: 'omit',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            handle: 'module11public',
            password: 'operator-password-1',
          }),
        })
      ).status,
    options.authOrigin,
  );
  assert.equal(registration, 202);
  await page.goto(options.authOrigin + '/auth/session');
  const cookieLogout = await page.evaluate(
    async () =>
      (
        await fetch('/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      ).status,
  );
  assert.equal(cookieLogout, 204);
  await login('module11public', 'Public user');
  assert.equal(await field.inputValue(), '');
  assert.match(
    (await page.getByTestId('cache-count').innerText()).trim(),
    /0$/,
  );
  await seedDraft('principal B private draft');
  stage = 'primary-backed token revocation during edit';
  const deniedToken = tokens.at(-1);
  const revoked = await page.evaluate(
    async ({ origin, token }) =>
      (
        await fetch(origin + '/auth/token/revoke', {
          method: 'POST',
          credentials: 'omit',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
        })
      ).status,
    { origin: options.authOrigin, token: deniedToken },
  );
  assert.equal(revoked, 204);
  const denied = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/account') && response.status() === 401,
  );
  await page
    .getByRole('button', { name: 'Validate draft', exact: true })
    .click();
  await denied;
  await assertCleared();
  stage = 'local expiry during edit';
  // Install the browser clock before mounting so the real expiry timer is controlled.
  await page.clock.install({ time: new Date() });
  await login(null, 'Public user');
  await seedDraft('expiry private draft');
  await page.clock.fastForward(600001);
  await assertCleared();
  await writeFile(
    'docs/plan/evidence/11-identity-browser.json',
    JSON.stringify(
      {
        environment:
          'real local Node/PostgreSQL and trusted HTTPS Chrome; shared source auth/Form primitives in test-only build',
        browser: browser.version(),
        principals: ['staff', 'user'],
        logoutDraftAndCacheCleared: true,
        differentPrincipalStartsEmpty: true,
        authServiceFirstPartyLogout: cookieLogout,
        revokedDuringEditDeniedStatus: 401,
        deniedDraftAndCacheCleared: true,
        expiryDraftAndCacheCleared: true,
        expiryClock:
          'Playwright fast-forward of actual browser expiry timer after real token issuance; backend time unchanged',
        persistentDraftOrTokenStorage: false,
        tlsVerificationBypass: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Real principal change, logout, revocation-during-edit and expiry clear drafts and private cache.',
  );
} catch (error) {
  failure = `Identity browser failure at ${stage}: ${error.name}; ${error.message.split('\n')[0].replace(/https?:\/\/[^\s]+/g, '[url]')}`;
} finally {
  await browser.close();
}
if (failure) throw new Error(failure);
