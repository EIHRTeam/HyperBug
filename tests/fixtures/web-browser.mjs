import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.HYPERBUG_PLAYWRIGHT_PATH ??
    '/Users/null/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
);
const options = JSON.parse(await readFile(process.argv[2], 'utf8'));
const profile = join(options.directory, 'web-chrome');
await mkdir(join(profile, 'Default'), { recursive: true });
await writeFile(
  join(profile, 'Default', 'Preferences'),
  JSON.stringify({
    profile: { block_third_party_cookies: true },
    tracking_protection: { block_all_3pc: true },
  }),
);
const context = await chromium.launchPersistentContext(profile, {
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: [
    '--no-proxy-server',
    '--host-resolver-rules=MAP *.test 127.0.0.1',
    '--test-third-party-cookie-phaseout',
  ],
});
let stage = 'trusted TLS and third-party cookie canary';
let failureMessage;
try {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCookieControls', {
    enableThirdPartyCookieRestriction: true,
    disableThirdPartyCookieMetadata: true,
    disableThirdPartyCookieHeuristics: true,
  });
  const blockedReasons = new Set();
  cdp.on('Network.requestWillBeSentExtraInfo', (event) => {
    for (const cookie of event.associatedCookies ?? [])
      if (cookie.cookie.name === 'cookie_canary')
        for (const reason of cookie.blockedReasons) blockedReasons.add(reason);
  });
  await page.goto(options.canaryOrigin + '/probe/set');
  await page.goto(options.canaryOrigin + '/probe/echo');
  assert.equal(
    JSON.parse(await page.locator('body').innerText()).cookiePresent,
    true,
  );
  await page.goto(options.origin + '/probe/control');
  const thirdPartyCanary = await page.evaluate(
    async (origin) =>
      (await fetch(origin + '/probe/echo', { credentials: 'include' })).json(),
    options.canaryOrigin,
  );
  assert.equal(thirdPartyCanary.cookiePresent, false);
  assert.ok(blockedReasons.size > 0);
  await page.goto(options.origin + '/account');
  const tokens = new Set();
  const cookieChecks = [];
  let callbackCount = 0;
  const consoleMessages = [];
  page.on('console', (message) => consoleMessages.push(message.text()));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === options.origin && url.pathname === '/oauth/callback')
      callbackCount++;
    if (
      url.origin === options.authOrigin &&
      ['/auth/token', '/auth/token/revoke', '/api/v1/account'].includes(
        url.pathname,
      )
    )
      cookieChecks.push(
        request
          .allHeaders()
          .then((headers) => !Object.hasOwn(headers, 'cookie')),
      );
  });
  page.on('response', async (response) => {
    if (
      response.url() === options.authOrigin + '/auth/token' &&
      response.status() === 200
    )
      tokens.add((await response.json()).accessToken);
  });
  stage = 'SPA PKCE login';
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Handle', { exact: true }).fill('rootadmin');
  await page
    .getByLabel('Password', { exact: true })
    .fill('operator-password-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'You are signed in.' }).waitFor();
  assert.equal(page.url(), options.origin + '/account');
  const storageCheck = () =>
    page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
      caches: await caches.keys(),
      databases:
        typeof indexedDB.databases === 'function'
          ? (await indexedDB.databases()).length
          : null,
    }));
  const initialStorage = await storageCheck();
  assert.deepEqual(initialStorage, {
    local: 0,
    session: 0,
    cookies: '',
    caches: [],
    databases: 0,
  });
  stage = 'reload and explicit top-level recovery';
  await page.reload();
  await page
    .getByRole('heading', { name: 'Sign in to this instance.' })
    .waitFor();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Authorize', exact: true }).click();
  await page.getByRole('heading', { name: 'You are signed in.' }).waitFor();
  await page.getByRole('button', { name: 'Check access', exact: true }).click();
  await page.getByText('Your access is current.').waitFor();
  stage = 'SPA API-only logout and revocation';
  const revoked = page.waitForResponse(
    (response) =>
      response.url().endsWith('/auth/token/revoke') &&
      response.status() === 204,
  );
  await page
    .getByRole('button', { name: 'Sign out of this app', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Sign in to this instance.' })
    .waitFor();
  await revoked;
  const revocation = await page.evaluate(
    async ({ origin, token }) =>
      (
        await fetch(origin + '/api/v1/account', {
          credentials: 'omit',
          headers: { authorization: 'Bearer ' + token },
        })
      ).status,
    { origin: options.authOrigin, token: [...tokens].at(-1) },
  );
  assert.equal(revocation, 401);
  const finalStorage = await storageCheck();
  assert.deepEqual(finalStorage, initialStorage);
  const cookieFree = await Promise.all(cookieChecks);
  assert.ok(cookieFree.length >= 5 && cookieFree.every(Boolean));
  assert.equal(callbackCount, 2);
  assert.ok(
    [...tokens].every(
      (token) =>
        !page.url().includes(token) &&
        !consoleMessages.some((message) => message.includes(token)),
    ),
  );
  await writeFile(
    options.receipt,
    JSON.stringify(
      {
        environment:
          'real local Node/PostgreSQL 18 and trusted HTTPS Chrome; no hosted traffic',
        browser: context.browser().version(),
        thirdPartyCookies: {
          firstPartyCanary: true,
          crossSiteCanary: false,
          blockedReasons: [...blockedReasons],
        },
        spaLogin: true,
        reloadLosesToken: true,
        topLevelRecovery: true,
        apiOnlyLogout: true,
        revokedTokenStatus: revocation,
        callbackCount,
        cookieFreeRequests: cookieFree.length,
        initialStorage,
        finalStorage,
        urlsAndConsoleTokenFree: true,
        tlsVerificationBypass: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'SPA login, reload/recovery, API-only logout, cookie controls and storage checks passed.',
  );
} catch (error) {
  failureMessage = `Module 11 browser failed at ${stage}: ${error.name}; ${error.message.split('\n')[0].replace(/https?:\/\/[^\s]+/g, '[url]')}`;
} finally {
  await context.close();
}
// Raw automation errors can include authorization URLs; retain only safe text.
if (failureMessage) throw new Error(failureMessage);
