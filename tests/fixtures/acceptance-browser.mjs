import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

// Bundled tool runtime; no product/test dependency is added to the workspace.
const { chromium } = await import(
  process.env.HYPERBUG_PLAYWRIGHT_PATH ??
    '/Users/null/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
);
const options = JSON.parse(await readFile(process.argv[2], 'utf8'));
const profileDirectory = join(options.directory, 'chrome');
await mkdir(join(profileDirectory, 'Default'), { recursive: true });
await writeFile(
  join(profileDirectory, 'Default', 'Preferences'),
  JSON.stringify({
    profile: { block_third_party_cookies: true },
    tracking_protection: { block_all_3pc: true },
  }),
);
const context = await chromium.launchPersistentContext(profileDirectory, {
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  ignoreHTTPSErrors: true,
  args: [
    '--no-proxy-server',
    '--host-resolver-rules=MAP *.test 127.0.0.1',
    '--test-third-party-cookie-phaseout',
  ],
});
let stage = 'cookie controls';
let formActionBlocked = false;
let activePage;
let failureMessage;
const networkFailures = new Set();
try {
  const page = await context.newPage();
  activePage = page;
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      message.text().includes("form-action 'self'")
    )
      formActionBlocked = true;
  });
  page.on('requestfailed', (request) =>
    networkFailures.add(request.failure()?.errorText ?? 'unknown'),
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCookieControls', {
    enableThirdPartyCookieRestriction: true,
    disableThirdPartyCookieMetadata: true,
    disableThirdPartyCookieHeuristics: true,
  });
  const blockedReasons = new Set();
  cdp.on('Network.requestWillBeSentExtraInfo', (event) => {
    for (const associated of event.associatedCookies ?? [])
      if (associated.cookie.name === 'cookie_canary')
        for (const reason of associated.blockedReasons)
          blockedReasons.add(reason);
  });
  await page.goto(`${options.canaryOrigin}/probe/set`);
  await page.goto(`${options.canaryOrigin}/probe/echo`);
  assert.equal(
    JSON.parse(await page.locator('body').innerText()).cookiePresent,
    true,
  );
  await page.goto(options.origin);
  const canary = await page.evaluate(
    async (origin) =>
      (await fetch(`${origin}/probe/echo`, { credentials: 'include' })).json(),
    options.canaryOrigin,
  );
  assert.equal(canary.cookiePresent, false);
  assert.ok(blockedReasons.size > 0);

  const cookieChecks = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.origin === options.authOrigin &&
      ['/auth/token', '/api/v1/account'].includes(url.pathname)
    )
      cookieChecks.push(
        request
          .allHeaders()
          .then((headers) => !Object.hasOwn(headers, 'cookie')),
      );
  });
  const authorize = async (login) => {
    const state = Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString('base64url');
    const verifier = Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString('base64url');
    const challenge = await page.evaluate(async (value) => {
      const bytes = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
      );
      return btoa(String.fromCharCode(...bytes))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
    }, verifier);
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: 'acceptance-browser',
      redirect_uri: `${options.origin}/oauth/callback`,
      scope: 'public-api',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    stage = login ? 'login page' : 'recovery consent page';
    await page.goto(`${options.authOrigin}/auth/authorize?${query}`);
    if (login) {
      await page.getByLabel('Handle', { exact: true }).fill('rootadmin');
      await page
        .getByLabel('Password', { exact: true })
        .fill('operator-password-1');
    }
    await page.evaluate(() => {
      globalThis.formActionViolation = false;
      document.addEventListener('securitypolicyviolation', (event) => {
        if (event.effectiveDirective === 'form-action')
          globalThis.formActionViolation = true;
      });
    });
    stage = login ? 'login redirect' : 'recovery redirect';
    await Promise.all([
      page.waitForURL(`${options.origin}/oauth/callback?**`, {
        timeout: 15000,
      }),
      page
        .getByRole('button', {
          name: login ? 'Sign in' : 'Authorize',
          exact: true,
        })
        .click(),
    ]);
    assert.equal(new URL(page.url()).searchParams.get('state'), state);
    stage = login ? 'login exchange' : 'recovery exchange';
    return page.evaluate(
      async ({ authOrigin, verifier: exchangeVerifier }) => {
        const code = new URL(location.href).searchParams.get('code');
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${location.origin}/oauth/callback`,
          client_id: 'acceptance-browser',
          code_verifier: exchangeVerifier,
        });
        const exchange = await fetch(`${authOrigin}/auth/token`, {
          method: 'POST',
          credentials: 'omit',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body,
        });
        const token = await exchange.json();
        const account = await fetch(`${authOrigin}/api/v1/account`, {
          credentials: 'omit',
          headers: { authorization: `Bearer ${token.accessToken}` },
        });
        const replay = await fetch(`${authOrigin}/auth/token`, {
          method: 'POST',
          credentials: 'omit',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body,
        });
        // Return only scalars, never the code, token, cookie or account body.
        return {
          exchange: exchange.status,
          account: account.status,
          replay: replay.status,
          localStorageKeys: localStorage.length,
          sessionStorageKeys: sessionStorage.length,
        };
      },
      { authOrigin: options.authOrigin, verifier },
    );
  };
  stage = 'first-party login redirect and cookie-free exchange';
  const login = await authorize(true);
  stage = `login scalar assertions ${JSON.stringify(login)}`;
  assert.equal(login.exchange, 200);
  assert.equal(login.account, 200);
  assert.equal(login.replay, 400);
  assert.equal(login.localStorageKeys, 0);
  assert.equal(login.sessionStorageKeys, 0);
  const cookies = await context.cookies(options.authOrigin);
  assert.ok(
    cookies.some(
      (cookie) =>
        cookie.name.startsWith('__Host-') && cookie.secure && cookie.httpOnly,
    ),
  );
  stage = 'top-level session recovery';
  const recovery = await authorize(false);
  stage = `recovery scalar assertions ${JSON.stringify(recovery)}`;
  assert.equal(recovery.exchange, 200);
  assert.equal(recovery.account, 200);
  assert.equal(recovery.replay, 400);
  const cookieFreeRequests = await Promise.all(cookieChecks);
  assert.equal(cookieFreeRequests.length, 6);
  assert.ok(cookieFreeRequests.every(Boolean));
  const frontendApiStatus = await page.evaluate(
    async () => (await fetch('/api/v1/instance')).status,
  );
  assert.equal(frontendApiStatus, 404);
  stage = 'exact redirect allowlist';
  const deniedRedirect = new URLSearchParams({
    response_type: 'code',
    client_id: 'acceptance-browser',
    redirect_uri: `${options.origin}/unregistered`,
    scope: 'public-api',
    state: 'negative-redirect',
    code_challenge: 'c'.repeat(43),
    code_challenge_method: 'S256',
  });
  const denied = await page.goto(
    `${options.authOrigin}/auth/authorize?${deniedRedirect}`,
  );
  assert.equal(denied.status(), 400);
  stage = 'exact origin allowlist';
  const wrongOrigin = options.origin.replace('client.', 'sibling.');
  await page.goto(wrongOrigin);
  const wrongOriginBlocked = await page.evaluate(async (authOrigin) => {
    try {
      await fetch(`${authOrigin}/api/v1/instance`, { credentials: 'omit' });
      return false;
    } catch {
      return true;
    }
  }, options.authOrigin);
  assert.equal(wrongOriginBlocked, true);
  const receipt = {
    profile: options.profile,
    environment:
      'local-real-Chrome-and-HTTPS; backend store classification supplied by owning journey',
    browser: context.browser().version(),
    sites: ['hyperbug-auth.test', 'hyperbug-browser.test'],
    thirdPartyCookies: {
      explicitlyBlocked: true,
      firstPartyCanary: true,
      crossSiteCanary: false,
      blockedReasons: [...blockedReasons],
    },
    login,
    recovery,
    exactOriginSiblingBlocked: true,
    unregisteredRedirectStatus: 400,
    cookieFreeTokenAndBusinessRequests: cookieFreeRequests.length,
    frontendApiStatus,
    tokenPersistence: 'memory-only',
    selfSignedTestTLS: true,
  };
  await writeFile(options.receipt, JSON.stringify(receipt), { mode: 0o600 });
} catch (error) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  formActionBlocked ||= await activePage
    ?.evaluate(() => globalThis.formActionViolation === true)
    .catch(() => false);
  const safeMessage = error.message
    .split('\n')[0]
    .replace(/https?:\/\/[^\s]+/g, '[url]');
  failureMessage = `Auth browser fixture failed at ${stage} (${error.name}); formActionBlocked=${formActionBlocked}; networkFailures=${JSON.stringify([...networkFailures])}; detail=${safeMessage}`;
} finally {
  await context.close();
}

// Discard raw Playwright errors, which can contain authorization URLs.
if (failureMessage) throw new Error(failureMessage);
