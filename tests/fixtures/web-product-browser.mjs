/* eslint-disable no-await-in-loop -- Personas and transitions share one bounded disposable fixture and require sequential verification. */
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.HYPERBUG_PLAYWRIGHT_PATH ??
    '/Users/null/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
);
const options = JSON.parse(await readFile(process.argv[2], 'utf8'));
const axeSource = process.env.HYPERBUG_AXE_PATH
  ? await readFile(process.env.HYPERBUG_AXE_PATH, 'utf8')
  : null;
const accessibilityAudits = [];
const browser = await chromium.launch({
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
let stage = 'anonymous project discovery';
let activePage;
async function uniqueAssociations(page) {
  const errors = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(
      (element) => element.id,
    );
    const invalid = ids.filter(
      (id, index) => ids.indexOf(id) !== index || /\s/.test(id),
    );
    for (const label of document.querySelectorAll('label[for]'))
      if (!document.getElementById(label.htmlFor))
        invalid.push('missing-label-target');
    for (const element of document.querySelectorAll('[aria-describedby]'))
      for (const id of element.getAttribute('aria-describedby').split(/\s+/))
        if (!document.getElementById(id)) invalid.push('missing-description');
    return invalid;
  });
  assert.deepEqual(errors, []);
}
async function command(page, name) {
  return page
    .locator('form')
    .filter({ has: page.getByRole('button', { name, exact: true }) });
}

const report = {
  profile: options.profile,
  browser: browser.version(),
  environment:
    'Disposable local services, production SPA build; no hosted requests',
  browserPath: 'Browser plugin not available; existing Playwright runtime',
  metricsCaveat:
    'Document-level lab observer diagnostics across SPA interactions and viewport changes. cls is cumulative layout-shift score, not the session-window CLS algorithm. interactions are event-duration candidates, not field INP. Minimum anonymous metrics reset on reload. No isolated-route CWV, hosted latency or SLO claim.',
  checks: [],
  screenshots: [],
  requests: [],
  metrics: {},
  manual: 'Not performed in this run',
};
report.httpErrors = [];
const checks = (name) => report.checks.push(name);
async function auditAccessibility(page, surface) {
  if (!axeSource) return;
  if (!(await page.evaluate(() => Boolean(globalThis.axe))))
    await page.evaluate(axeSource);
  const result = await page.evaluate(async () => {
    globalThis.axe.configure({ noHtml: true });
    const audit = await globalThis.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
      resultTypes: ['violations', 'incomplete'],
    });
    const summarize = (rules) =>
      rules.map((rule) => ({
        id: rule.id,
        impact: rule.impact,
        nodes: rule.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      }));
    const contrastReview = audit.incomplete
      .filter((rule) => rule.id === 'color-contrast')
      .flatMap((rule) =>
        rule.nodes.map((node) => {
          const element =
            node.target.length === 1 && typeof node.target[0] === 'string'
              ? document.querySelector(node.target[0])
              : null;
          if (!element)
            return { target: node.target, status: 'unresolved selector' };
          const style = getComputedStyle(element);
          const rgb = (color) =>
            /^rgba?\(/.test(color) ? color.match(/[\d.]+/g).map(Number) : null;
          const foreground = rgb(style.color);
          let current = element,
            background = null;
          while (current && !background) {
            const value = rgb(getComputedStyle(current).backgroundColor);
            if (value && (value[3] ?? 1) === 1) background = value;
            current = current.parentElement;
          }
          const luminance = (color) =>
            color
              .slice(0, 3)
              .map((v) => {
                const s = v / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
          const fg = foreground && luminance(foreground),
            bg = background && luminance(background);
          const ratio =
            fg !== null && bg !== null
              ? (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
              : null;
          return {
            target: node.target,
            foreground: style.color,
            background,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            computedStyleRatio: ratio,
            status:
              'Computed styles supplement the incomplete result; visual overlap/native-control review still required',
          };
        }),
      );
    return {
      engine: audit.testEngine,
      violations: summarize(audit.violations),
      incomplete: summarize(audit.incomplete),
      contrastReview,
    };
  });
  accessibilityAudits.push({ surface, ...result });
  if (surface.startsWith('Confirmation:')) {
    const path = `/tmp/hyperbug12-${options.profile}-dialog-${surface.includes('Close') ? 'triage' : 'settings'}.png`;
    await page.screenshot({ path });
    report.screenshots.push(path);
  }
}
async function observe(page) {
  await page.addInitScript(() => {
    globalThis.metrics = {
      lcp: null,
      cls: 0,
      longTasks: [],
      interactions: [],
      violations: [],
    };
    for (const [type, handler] of [
      [
        'largest-contentful-paint',
        (entry) => (globalThis.metrics.lcp = entry.startTime),
      ],
      [
        'layout-shift',
        (entry) => {
          if (!entry.hadRecentInput) globalThis.metrics.cls += entry.value;
        },
      ],
      [
        'longtask',
        (entry) => globalThis.metrics.longTasks.push(entry.duration),
      ],
      [
        'event',
        (entry) => {
          if (entry.interactionId)
            globalThis.metrics.interactions.push(entry.duration);
        },
      ],
    ]) {
      try {
        new PerformanceObserver((list) =>
          list.getEntries().forEach(handler),
        ).observe({
          type,
          buffered: true,
          ...(type === 'event' ? { durationThreshold: 16 } : {}),
        });
      } catch {}
    }
    document.addEventListener('securitypolicyviolation', (event) =>
      globalThis.metrics.violations.push(event.effectiveDirective),
    );
  });
  const errors = [];
  page.on('response', async (response) => {
    const url = new URL(response.url());
    if (url.origin === options.apiOrigin && response.status() >= 400) {
      let code;
      try {
        code = (await response.json()).error?.code;
      } catch {}
      report.httpErrors.push({
        path: url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'),
        status: response.status(),
        code,
      });
    }
  });
  page.on('pageerror', (error) => errors.push(error.name));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === options.apiOrigin)
      report.requests.push({
        method: request.method(),
        path: url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'),
      });
  });
  return errors;
}
async function openProject(page) {
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByLabel('Project ID', { exact: true }).fill(options.projectId);
  await page.getByRole('link', { name: 'Open project', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Product workflows', exact: true })
    .waitFor();
}
async function openDiscussion(page) {
  await page.getByLabel('Search issues', { exact: true }).fill('discussion');
  await page
    .getByRole('link', { name: '#1 A discussion with history', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'A discussion with history', exact: true })
    .waitFor();
}
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
async function confirm(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  if (['Close issue', 'Save project settings'].includes(name))
    await auditAccessibility(
      typeof page.page === 'function' ? page.page() : page,
      `Confirmation: ${name}`,
    );
  await page
    .getByRole('dialog')
    .getByRole('button', { name, exact: true })
    .click();
}
try {
  const anonymous = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await anonymous.newPage();
  activePage = page;
  const errors = await observe(page);
  await page.goto(options.origin);
  await page.getByRole('heading', { name: /A shared place/ }).waitFor();
  await openProject(page);
  await page.getByRole('link', { name: 'Next page', exact: true }).waitFor();
  const firstCount = await page.locator('.issue-list > li').count();
  assert.ok(firstCount <= (options.profile === 'minimum' ? 10 : 20));
  await page.getByRole('link', { name: 'Next page', exact: true }).click();
  await page.waitForURL((url) => url.searchParams.has('after'));
  await page.goBack();
  await page.waitForURL((url) => !url.searchParams.get('after'));
  checks('anonymous project landing, bounded list, URL cursor/back navigation');
  await page.getByLabel('Search issues', { exact: true }).fill('state:open');
  await page.waitForURL((url) => url.searchParams.get('q') === 'state:open');
  const sharedSearch = page.url();
  await page.reload();
  await page.getByLabel('Search issues', { exact: true }).waitFor();
  assert.equal(page.url(), sharedSearch);
  assert.equal(
    await page.getByLabel('Search issues', { exact: true }).inputValue(),
    'state:open',
  );
  checks('shared bookmarked search survives a full public-page reload');
  await page
    .getByLabel('Search issues', { exact: true })
    .fill('AND unsupported');
  await page
    .getByRole('alert')
    .filter({ hasText: /Check the search syntax/ })
    .waitFor();
  checks('structured search and safe syntax error');
  await auditAccessibility(page, 'Anonymous search error');
  await openDiscussion(page);
  await page.locator('.timeline > li').first().waitFor();
  assert.ok((await page.locator('.timeline > li').count()) <= 20);
  assert.equal(
    await page.evaluate(() => globalThis.userContentExecuted),
    undefined,
  );
  assert.equal(await page.locator('.markdown script').count(), 0);
  assert.equal(
    await page.locator('img[src^="https://example.com"]').count(),
    0,
  );
  checks('server safe-tree rendering and inert external images');
  await auditAccessibility(page, 'Anonymous large discussion');
  const discussionUrl = page.url();
  stage = 'transported Markdown corpus';
  await page.goto(
    `${options.origin}/projects/${options.projectId}/issues/${options.corpus.id}/${options.corpus.number}`,
  );
  await page.locator('.timeline > li').nth(19).waitFor();
  assert.equal(
    await page.locator('.markdown').count(),
    options.corpusAccepted,
    'all transported corpus representations rendered',
  );
  assert.equal(
    await page
      .locator(
        '.markdown script,.markdown style,.markdown iframe,.markdown object,.markdown embed,.markdown svg,.markdown math,.markdown form',
      )
      .count(),
    0,
  );
  assert.equal(await page.locator('.markdown img').count(), 0);
  assert.equal(
    await page.locator('.markdown input:not([disabled])').count(),
    0,
  );
  assert.equal(
    await page
      .locator('.markdown a[href]')
      .evaluateAll(
        (links) =>
          links.filter(
            (a) => !/^(https?:|mailto:|\/|#)/i.test(a.getAttribute('href')),
          ).length,
      ),
    0,
  );
  assert.equal(
    await page
      .locator('.markdown *')
      .evaluateAll(
        (elements) =>
          elements.filter((element) =>
            [...element.attributes].some((attribute) =>
              /^on/i.test(attribute.name),
            ),
          ).length,
      ),
    0,
  );
  checks(
    `transported Markdown corpus: ${options.corpusAccepted} accepted representations rendered, ${options.corpusRejected} invalid bodies rejected by actual API`,
  );
  await uniqueAssociations(page);
  await page.goto(discussionUrl);
  await page.locator('.timeline > li').first().waitFor();
  const desktop = `/tmp/hyperbug12-${options.profile}-detail.png`;
  await page.screenshot({ path: desktop });
  report.screenshots.push(desktop);
  await page
    .getByRole('link', { name: 'Next timeline page', exact: true })
    .click();
  await page.waitForURL((url) => Boolean(url.searchParams.get('cursor')));
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Discussion and timeline',
  );
  assert.ok((await page.locator('.timeline > li').count()) <= 20);
  await page
    .getByRole('link', { name: 'Permalink', exact: true })
    .first()
    .click();
  await page
    .getByRole('heading', { name: 'Linked comment', exact: true })
    .waitFor();
  await page.waitForFunction(() => {
    const entry = document.getElementById(location.hash.slice(1));
    if (!entry) return false;
    const bounds = entry.getBoundingClientRect();
    return bounds.top < innerHeight && bounds.bottom > 0;
  });
  checks(
    '1,000-comment window, page focus, native scroll anchor and visible comment permalink',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const mobile = `/tmp/hyperbug12-${options.profile}-mobile.png`;
  await page.screenshot({ path: mobile });
  report.screenshots.push(mobile);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  checks('390px layout and reduced-motion emulation');
  if (options.profile === 'minimum') {
    const notice = page.getByRole('complementary', {
      name: 'Minimum tier status',
    });
    await notice
      .getByRole('button', { name: 'Dismiss details for this session' })
      .click();
    await page.getByRole('link', { name: 'Account', exact: true }).click();
    assert.match(await notice.innerText(), /Cloudflare Minimum/);
    assert.equal(await notice.getByRole('button').count(), 0);
    await page.reload();
    await page
      .getByRole('heading', { name: 'Sign in to this instance.', exact: true })
      .waitFor();
    assert.equal(await notice.getByRole('button').count(), 0);
    checks(
      'minimum persistent status, session dismissal across navigation/reload',
    );
  }
  report.metrics.anonymous = await page.evaluate(() => globalThis.metrics);
  assert.deepEqual(errors, []);
  assert.deepEqual(report.metrics.anonymous.violations, []);
  await anonymous.close();
  for (const [handle, role] of [
    ['feedbackuser', 'Public User'],
    ['triager', 'Triage'],
    ['maintainer', 'Maintainer'],
    ['rootadmin', 'Administrator'],
  ]) {
    stage = `${role} real browser sign-in and workflow`;
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const user = await context.newPage();
    if (handle === 'maintainer') await user.clock.install();
    activePage = user;
    const userErrors = await observe(user);
    await signIn(user, handle);
    if (handle === 'rootadmin') {
      await user
        .getByRole('link', { name: 'Instance plugins', exact: true })
        .click();
      await user.getByText(/recent verified passkey sign-in/).waitFor();
      checks(
        'password-only sensitive administration is denied and clears stale identity state',
      );
      await user.getByRole('link', { name: 'Account', exact: true }).click();
      const cdp = await context.newCDPSession(user);
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
      await user.getByRole('button', { name: 'Sign in', exact: true }).click();
      await user
        .getByRole('button', { name: 'Register a passkey', exact: true })
        .click();
      await user.getByText(/Passkey registered/).waitFor();
      // Exercise the asset's native cancellation boundary once; restore the
      // original method before the next fully native verification ceremony.
      await user.evaluate(() => {
        const original = navigator.credentials.get;
        navigator.credentials.get = async function () {
          this.get = original;
          throw new DOMException('Test cancellation', 'NotAllowedError');
        };
      });
      await user
        .getByRole('button', { name: 'Use a passkey', exact: true })
        .click();
      await user
        .getByText(/The passkey operation was cancelled or could not complete/)
        .waitFor();
      assert.equal(
        await user
          .getByRole('button', { name: 'Use a passkey', exact: true })
          .isEnabled(),
        true,
      );
      checks(
        'first-party asset recovers from a simulated native NotAllowedError without granting assurance; subsequent registration/login remains native',
      );
      await Promise.all([
        user.waitForEvent('load'),
        user
          .getByRole('button', { name: 'Use a passkey', exact: true })
          .click(),
      ]);
      await user
        .getByRole('button', { name: 'Authorize', exact: true })
        .waitFor();
      await user
        .getByRole('button', { name: 'Authorize', exact: true })
        .click();
      await user
        .getByRole('heading', { name: 'You are signed in.', exact: true })
        .waitFor();
      checks(
        'native virtual-authenticator registration/login through first-party controls and PKCE step-up',
      );
    }
    stage = `${role} project navigation`;
    await openProject(user);
    if (options.profile === 'minimum') {
      const notice = user.getByRole('complementary', {
        name: 'Minimum tier status',
      });
      await notice
        .getByRole('button', {
          name: 'Dismiss details for this session',
          exact: true,
        })
        .waitFor();
      assert.match(await notice.innerText(), /PBKDF2-HMAC-SHA256/);
      assert.ok(!(await notice.innerText()).includes('Argon2id'));
    }
    if (handle === 'feedbackuser') {
      await user.getByRole('link', { name: 'New issue', exact: true }).click();
      await user
        .getByLabel('Submission format', { exact: true })
        .selectOption({ label: 'Detailed report' });
      await user.getByLabel('Issue title (required)', { exact: true }).clear();
      stage = 'Public User Issue Form initial validation';
      await user
        .getByRole('button', { name: 'Submit Issue Form', exact: true })
        .click();
      await user
        .getByRole('heading', {
          name: 'Check the following fields',
          exact: true,
        })
        .waitFor();
      await auditAccessibility(user, 'Public User form validation');
      assert.equal(
        await user
          .getByLabel('Issue title (required)', { exact: true })
          .getAttribute('aria-invalid'),
        'true',
      );
      await user
        .getByRole('link', {
          name: 'Enter an issue title of 1–200 characters.',
          exact: true,
        })
        .click();
      assert.equal(
        await user
          .getByLabel('Issue title (required)', { exact: true })
          .evaluate((element) => document.activeElement === element),
        true,
      );
      await user
        .getByLabel('Issue title (required)', { exact: true })
        .fill(`Browser form report ${options.profile}`);
      await user
        .getByLabel('Summary (required)', { exact: true })
        .fill('A confirmed summary');
      await user
        .getByLabel('Details (required)', { exact: true })
        .fill('**Formatted details**');
      await user.getByLabel('Version', { exact: true }).selectOption('two');
      await user
        .getByLabel('Platforms', { exact: true })
        .selectOption(['desktop', 'mobile']);
      await uniqueAssociations(user);
      await user.getByLabel(/I checked existing reports/).check();
      stage = 'Public User server form preview';
      await user
        .getByRole('button', { name: 'Preview current content', exact: true })
        .click();
      await user.getByText('Formatted details', { exact: true }).waitFor();
      stage = 'Public User Issue Form ambiguous submission';
      const formKeys = [];
      let loseFormResponse = true;
      await user.route('**/submissions', async (route) => {
        formKeys.push(route.request().headers()['idempotency-key']);
        if (loseFormResponse) {
          await route.fetch();
          return route.abort('failed');
        }
        return route.continue();
      });
      await user
        .getByRole('button', { name: 'Submit Issue Form', exact: true })
        .click();
      await user
        .getByRole('alert')
        .filter({ hasText: /result is uncertain/ })
        .waitFor();
      assert.equal(
        await user
          .getByLabel('Issue title (required)', { exact: true })
          .getAttribute('readonly'),
        '',
      );
      assert.equal(
        await user.getByLabel('Version', { exact: true }).isDisabled(),
        true,
      );
      loseFormResponse = false;
      await user
        .getByRole('button', { name: 'Submit Issue Form', exact: true })
        .click();
      await user.unroute('**/submissions');
      assert.ok(formKeys.length >= 2);
      assert.ok(formKeys[0]);
      assert.ok(formKeys.every((key) => key === formKeys[0]));
      checks(
        'Issue Form: actual post-commit lost responses lock fields and retry one unchanged receipt',
      );
      await user
        .getByRole('heading', {
          name: `Browser form report ${options.profile}`,
          exact: true,
        })
        .waitFor();
      checks(
        'Public User: every non-upload form field including multi-select, focused validation and server preview/submission',
      );
      await user
        .getByLabel('Content (required)', { exact: true })
        .fill('A browser comment');
      await user
        .getByRole('button', { name: 'Post comment', exact: true })
        .click();
      await user.getByText('A browser comment', { exact: true }).waitFor();
      await user
        .getByLabel('Choose a reaction', { exact: true })
        .selectOption('heart');
      await user
        .getByRole('button', { name: 'Add reaction', exact: true })
        .click();
      await user.getByText('heart 1', { exact: true }).waitFor();
      checks('Public User: comment and reaction through actual API');
      const receiptKeys = [];
      let intercepted = false;
      await user.route('**/comments', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        receiptKeys.push(route.request().headers()['idempotency-key']);
        if (!intercepted) {
          intercepted = true;
          await route.fetch();
          return route.abort('failed');
        }
        return route.continue();
      });
      await user
        .getByLabel('Content (required)', { exact: true })
        .fill('Retry exactly once');
      await user
        .getByRole('button', { name: 'Post comment', exact: true })
        .click();
      await user
        .getByRole('alert')
        .filter({ hasText: /result is uncertain/ })
        .waitFor();
      await user
        .getByRole('button', { name: 'Post comment', exact: true })
        .click();
      await user.getByText('Retry exactly once', { exact: true }).waitFor();
      assert.equal(
        await user.getByText('Retry exactly once', { exact: true }).count(),
        1,
      );
      assert.equal(receiptKeys.length, 2);
      assert.ok(receiptKeys[0]);
      assert.equal(receiptKeys[0], receiptKeys[1]);
      checks(
        'ambiguous response after actual commit: unchanged receipt retry produces one comment',
      );
      await user.unroute('**/comments');
      stage = 'Public User comment edit and concurrent conflict recovery';
      const commentRow = user
        .locator('.timeline > li')
        .filter({ has: user.getByText('A browser comment', { exact: true }) });
      await commentRow
        .getByText('Comment actions and reactions', { exact: true })
        .click();
      await commentRow
        .getByRole('button', { name: 'Edit comment', exact: true })
        .click();
      await commentRow
        .getByLabel('Content (required)', { exact: true })
        .fill('A revised browser comment');
      await uniqueAssociations(user);
      let conflicting = true;
      await user.route('**/comments/*', async (route) => {
        if (route.request().method() === 'PATCH' && conflicting) {
          conflicting = false;
          const body = route.request().postDataJSON();
          const response = await route.fetch({
            headers: {
              ...route.request().headers(),
              'idempotency-key': crypto.randomUUID(),
            },
            postData: { ...body, body: 'Concurrent comment revision' },
          });
          assert.equal(response.status(), 200);
        }
        return route.continue();
      });
      await commentRow
        .getByRole('button', { name: 'Save comment', exact: true })
        .click();
      await commentRow
        .getByRole('alert')
        .filter({ hasText: /This item changed/ })
        .waitFor();
      assert.equal(
        await commentRow
          .getByLabel('Content (required)', { exact: true })
          .inputValue(),
        'A revised browser comment',
      );
      // Refetch replaces the timeline row's text and remounts only this editor.
      await commentRow
        .getByRole('button', {
          name: 'Discard comment draft and reload latest',
          exact: true,
        })
        .click();
      const currentComment = commentRow;
      await currentComment
        .getByLabel('Content (required)', { exact: true })
        .waitFor();
      assert.equal(
        await currentComment
          .getByLabel('Content (required)', { exact: true })
          .inputValue(),
        'Concurrent comment revision',
      );
      await currentComment
        .getByLabel('Content (required)', { exact: true })
        .fill('A revised browser comment');
      await currentComment
        .getByRole('button', { name: 'Save comment', exact: true })
        .click();
      await user
        .getByText('A revised browser comment', { exact: true })
        .waitFor();
      await user
        .getByRole('button', { name: 'Cancel comment edit', exact: true })
        .waitFor({ state: 'hidden' });
      await user.unroute('**/comments/*');
      checks(
        'comment edit: duplicate-ID-free composer, actual competing revision, preserved draft and explicit reload recovery',
      );
      stage = 'Public User comment tombstone';
      const deleted = user
        .locator('.timeline > li')
        .filter({ has: user.getByText('Retry exactly once', { exact: true }) });
      await deleted
        .getByText('Comment actions and reactions', { exact: true })
        .click();
      await confirm(deleted, 'Delete my comment');
      await user
        .getByText('Retry exactly once', { exact: true })
        .waitFor({ state: 'hidden' });
      checks(
        'Public User: confirmed comment deletion removes the restricted body from public timeline',
      );
      stage = 'Public User offline comment retry';
      await context.setOffline(true);
      await user
        .getByLabel('Content (required)', { exact: true })
        .fill('Recovered after offline');
      await user
        .getByRole('button', { name: 'Post comment', exact: true })
        .click();
      await user
        .getByRole('alert')
        .filter({ hasText: /result is uncertain/ })
        .waitFor();
      await context.setOffline(false);
      await user
        .getByRole('button', { name: 'Post comment', exact: true })
        .click();
      await user
        .getByText('Recovered after offline', { exact: true })
        .waitFor();
      checks(
        'offline comment failure preserves locked draft and retries successfully',
      );
      await auditAccessibility(user, 'Public User issue and comment controls');
      stage = 'Public User stale Issue Form recovery';
      await user.getByRole('link', { name: 'New issue', exact: true }).click();
      await user
        .getByLabel('Submission format', { exact: true })
        .selectOption({ label: 'Detailed report' });
      await user
        .getByLabel('Issue title (required)', { exact: true })
        .fill('A stale draft');
      await user
        .getByLabel('Summary (required)', { exact: true })
        .fill('Stale summary');
      await user
        .getByLabel('Details (required)', { exact: true })
        .fill('Stale details');
      await user.getByLabel(/I checked existing reports/).check();
      assert.equal(
        (
          await fetch(options.controlOrigin + '/replace-form', {
            method: 'POST',
          })
        ).status,
        204,
      );
      await user
        .getByRole('button', { name: 'Submit Issue Form', exact: true })
        .click();
      await user
        .getByRole('alert')
        .filter({ hasText: /This item changed/ })
        .waitFor();
      assert.equal(
        await user
          .getByLabel('Summary (required)', { exact: true })
          .inputValue(),
        'Stale summary',
      );
      await user
        .getByRole('button', {
          name: 'Discard form draft and reload latest definition',
          exact: true,
        })
        .click();
      await user
        .getByRole('heading', { name: 'Detailed report v2', exact: true })
        .waitFor();
      assert.equal(
        await user
          .getByLabel('Summary (required)', { exact: true })
          .inputValue(),
        '',
      );
      await user
        .getByLabel('Issue title (required)', { exact: true })
        .fill('Recovered form version');
      await user
        .getByLabel('Summary (required)', { exact: true })
        .fill('Reviewed v2');
      await user
        .getByLabel('Details (required)', { exact: true })
        .fill('Current details');
      await user.getByLabel(/I checked existing reports/).check();
      await user
        .getByRole('button', { name: 'Submit Issue Form', exact: true })
        .click();
      await user
        .getByRole('heading', { name: 'Recovered form version', exact: true })
        .waitFor();
      checks(
        'actual concurrent form replacement rejects stale submission, preserves draft, explicitly reloads v2 and accepts reviewed answers',
      );
      stage = 'Public User issue edit conflict and reload';
      await user
        .getByRole('button', { name: 'Edit issue', exact: true })
        .click();
      const issueEditor = user.getByRole('region', {
        name: 'Edit issue',
        exact: true,
      });
      await issueEditor
        .getByLabel('Content (required)', { exact: true })
        .fill('A reviewed issue revision');
      let issueConflict = true;
      await user.route('**/issues/*', async (route) => {
        if (route.request().method() === 'PATCH' && issueConflict) {
          issueConflict = false;
          const response = await route.fetch({
            headers: {
              ...route.request().headers(),
              'idempotency-key': crypto.randomUUID(),
            },
            postData: {
              ...route.request().postDataJSON(),
              body: 'Concurrent issue revision',
            },
          });
          assert.equal(response.status(), 200);
        }
        await route.continue();
      });
      await issueEditor
        .getByRole('button', { name: 'Save issue', exact: true })
        .click();
      await issueEditor
        .getByRole('alert')
        .filter({ hasText: /This item changed/ })
        .waitFor();
      assert.equal(
        await issueEditor
          .getByLabel('Content (required)', { exact: true })
          .inputValue(),
        'A reviewed issue revision',
      );
      await issueEditor
        .getByRole('button', {
          name: 'Discard issue draft and reload latest',
          exact: true,
        })
        .click();
      await issueEditor
        .getByLabel('Content (required)', { exact: true })
        .waitFor();
      assert.equal(
        await issueEditor
          .getByLabel('Content (required)', { exact: true })
          .inputValue(),
        'Concurrent issue revision',
      );
      await issueEditor
        .getByLabel('Content (required)', { exact: true })
        .fill('A reviewed issue revision');
      await issueEditor
        .getByRole('button', { name: 'Save issue', exact: true })
        .click();
      await issueEditor.waitFor({ state: 'hidden' });
      await user
        .getByText('A reviewed issue revision', { exact: true })
        .waitFor();
      await user.unroute('**/issues/*');
      checks(
        'issue edit: actual competing revision, retained draft, explicit fetched-snapshot reload and reviewed save',
      );
      stage = 'Public User real bearer revocation during draft';
      await user
        .getByLabel('Content (required)', { exact: true })
        .fill('A draft that must clear on revocation');
      await user.route('**/comments', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        const headers = {
          origin: options.apiOrigin,
          authorization: route.request().headers().authorization,
        };
        const revoked = await user.request.post(
          options.apiOrigin + '/auth/token/revoke',
          {
            headers: { origin: options.apiOrigin },
            form: { token: headers.authorization.slice(7) },
          },
        );
        assert.equal(revoked.status(), 204);
        return route.continue();
      });
      await user
        .getByRole('button', { name: 'Post comment', exact: true })
        .click();
      await user
        .getByText('Sign in to join the discussion', { exact: true })
        .waitFor();
      assert.equal(await user.getByRole('textbox').count(), 0);
      assert.ok(
        !(await user.locator('body').innerText()).includes(
          'A draft that must clear on revocation',
        ),
      );
      await user.unroute('**/comments');
      checks(
        'actual bearer revocation during comment submission rejects access and clears identity-bound draft',
      );
    } else {
      await openDiscussion(user);
      if (handle === 'triager') {
        await user.getByText('Triage issue', { exact: true }).click();
        stage = 'Triage close';
        await confirm(user, 'Close issue');
        await user
          .getByRole('button', { name: 'Reopen issue', exact: true })
          .waitFor();
        stage = 'Triage reopen';
        await confirm(user, 'Reopen issue');
        await user
          .getByRole('button', { name: 'Close issue', exact: true })
          .waitFor();
        checks('Triage: confirmed close/reopen with current revisions');
        for (const [name, label, source] of [
          [
            'Set issue labels',
            'Label IDs, separated by commas; empty clears labels',
            'Available labels:',
          ],
          [
            'Set issue type',
            'Issue type ID; empty clears type',
            'Available types:',
          ],
          [
            'Set issue milestone',
            'Milestone ID; empty clears milestone',
            'Available milestones:',
          ],
        ]) {
          await user
            .getByRole('button', {
              name: 'Discard triage edits and reload latest values',
              exact: true,
            })
            .click();
          const text = await user
            .locator('p')
            .filter({ hasText: source })
            .innerText();
          const id = text.match(/\(([0-9a-f-]{36})\)/)[1];
          const form = await command(user, name);
          await form.getByLabel(label, { exact: true }).fill(id);
          await form.getByRole('button', { name, exact: true }).click();
          await form.getByText('Changes saved.', { exact: true }).waitFor();
        }
        await user
          .getByRole('button', {
            name: 'Discard triage edits and reload latest values',
            exact: true,
          })
          .click();
        const assignees = await command(user, 'Set issue assignees');
        await assignees
          .getByRole('textbox')
          .fill(options.principalIds.maintainer);
        await assignees
          .getByRole('button', { name: 'Set issue assignees', exact: true })
          .click();
        await assignees.getByText('Changes saved.', { exact: true }).waitFor();
        checks(
          'Triage: actual label, type, milestone and eligible Staff assignee assignments with fresh revisions',
        );
        await auditAccessibility(user, 'Triage controls');
        stage = 'Triage actual permission loss during draft';
        await user
          .getByRole('button', {
            name: 'Discard triage edits and reload latest values',
            exact: true,
          })
          .click();
        const pendingLabels = await command(user, 'Set issue labels');
        await pendingLabels
          .getByRole('textbox')
          .fill('00000000-0000-4000-8000-000000000001');
        assert.equal(
          (
            await fetch(options.controlOrigin + '/drop-triage', {
              method: 'POST',
            })
          ).status,
          204,
        );
        await pendingLabels
          .getByRole('button', { name: 'Set issue labels', exact: true })
          .click();
        await user
          .getByText('Sign in to join the discussion', { exact: true })
          .waitFor();
        assert.equal(await user.getByRole('textbox').count(), 0);
        checks(
          'actual role revocation denies triage write and clears permission-bound controls/drafts',
        );
      } else if (handle === 'maintainer') {
        stage = 'Maintainer comment history and moderation';
        await user.getByRole('link', { name: 'Issues', exact: true }).click();
        await user
          .getByLabel('Search issues', { exact: true })
          .fill('Browser form report');
        await user
          .getByRole('link', {
            name: new RegExp(`Browser form report ${options.profile}$`),
          })
          .click();
        const revised = user.locator('.timeline > li').filter({
          has: user.getByText('A revised browser comment', { exact: true }),
        });
        await revised
          .getByText('Comment actions and reactions', { exact: true })
          .click();
        await revised
          .getByRole('button', {
            name: 'View edit history (Maintainer)',
            exact: true,
          })
          .click();
        await revised
          .locator('pre')
          .filter({ hasText: /^Concurrent comment revision$/ })
          .waitFor();
        await revised
          .getByLabel('Moderation state (Maintainer)', { exact: true })
          .selectOption('hidden');
        await confirm(revised, 'Moderate comment');
        await user.getByText('Comment hidden.', { exact: true }).waitFor();
        const hidden = user
          .locator('.timeline > li')
          .filter({ has: user.getByText('Comment hidden.', { exact: true }) });
        await hidden
          .getByLabel('Moderation state (Maintainer)', { exact: true })
          .selectOption('visible');
        await confirm(hidden, 'Moderate comment');
        await user
          .getByText('A revised browser comment', { exact: true })
          .waitFor();
        checks(
          'Maintainer: restricted edit history, confirmed hide and restore through actual APIs',
        );
        const visibleAgain = user.locator('.timeline > li').filter({
          has: user.getByText('A revised browser comment', { exact: true }),
        });
        await visibleAgain
          .getByLabel('Moderation state (Maintainer)', { exact: true })
          .selectOption('redacted');
        await confirm(visibleAgain, 'Moderate comment');
        await user.getByText('Comment redacted.', { exact: true }).waitFor();
        checks(
          'Maintainer: actual redaction hides the public timeline body while retaining staff-restricted history',
        );

        await user
          .getByRole('link', { name: 'Manage project', exact: true })
          .click();
        await user
          .locator('summary')
          .filter({ hasText: /^Labels$/ })
          .click();
        const labelForm = user.locator('form').filter({
          has: user.getByRole('button', {
            name: 'Create label',
            exact: true,
          }),
        });
        await labelForm
          .getByLabel('Label name (required)', { exact: true })
          .fill('Browser label');
        await labelForm
          .getByRole('button', { name: 'Create label', exact: true })
          .click();
        await user
          .getByRole('heading', { name: 'Browser label', exact: true })
          .waitFor();
        checks('Maintainer: actual label management');
        stage = 'Maintainer complete taxonomy and content controls';
        await user
          .locator('summary')
          .filter({ hasText: /^Issue types$/ })
          .click();
        const typeForm = await command(user, 'Create issue type');
        await typeForm
          .getByLabel('Type name (required)', { exact: true })
          .fill('Browser type');
        await typeForm
          .getByLabel('Description', { exact: true })
          .fill('Browser type description');
        await typeForm.getByLabel('Icon text', { exact: true }).fill('bug');
        await typeForm
          .getByLabel('Color (#rrggbb or empty)', { exact: true })
          .fill('#24683b');
        await typeForm
          .getByLabel('Sort position (required)', { exact: true })
          .fill('2');
        await typeForm
          .getByRole('button', { name: 'Create issue type', exact: true })
          .click();
        await user
          .getByRole('heading', { name: 'Browser type', exact: true })
          .waitFor();
        await user
          .locator('summary')
          .filter({ hasText: /^Milestones$/ })
          .click();
        const milestoneForm = await command(user, 'Create milestone');
        await milestoneForm
          .getByLabel('Milestone title (required)', { exact: true })
          .fill('Browser milestone');
        await milestoneForm
          .getByLabel('Description', { exact: true })
          .fill('Browser milestone description');
        await milestoneForm
          .getByLabel('Due date (optional)', { exact: true })
          .fill('2027-01-15');
        await milestoneForm
          .getByRole('button', { name: 'Create milestone', exact: true })
          .click();
        await user
          .getByRole('heading', { name: 'Browser milestone', exact: true })
          .waitFor();
        await user
          .locator('summary')
          .filter({ hasText: /^Markdown templates$/ })
          .click();
        const templateForm = await command(
          user,
          'Replace template Short report',
        );
        await templateForm
          .getByLabel('Replacement Markdown (required)', { exact: true })
          .fill('## Reviewed replacement');
        await confirm(templateForm, 'Replace template Short report');
        await templateForm
          .getByText('Changes saved.', { exact: true })
          .waitFor();
        await user
          .getByRole('heading', {
            name: 'Short report · revision 2',
            exact: true,
          })
          .waitFor();
        await uniqueAssociations(user);
        checks(
          'Maintainer: full type metadata, milestone due date and confirmed template replacement',
        );
        await auditAccessibility(user, 'Maintainer expanded management');
        stage = 'Maintainer actual Issue Form creation and replacement';
        await user
          .locator('summary')
          .filter({ hasText: /^Issue Forms$/ })
          .click();
        const source =
          'name: Browser managed form\ndescription: Browser management proof\nbody:\n- type: input\n  id: answer\n  attributes:\n    label: Answer\n  validations:\n    required: true\n';
        const createForm = await command(user, 'Create Issue Form');
        await createForm
          .getByLabel('YAML definition (required)', { exact: true })
          .fill(source);
        await createForm
          .getByRole('button', { name: 'Create Issue Form', exact: true })
          .click();
        await user
          .getByRole('heading', {
            name: 'Browser managed form · revision 1',
            exact: true,
          })
          .waitFor();
        const replaceManaged = await command(
          user,
          'Replace form Browser managed form',
        );
        await replaceManaged
          .getByLabel('Replacement YAML definition (required)', { exact: true })
          .fill(
            source.replace('Browser managed form', 'Browser managed form v2'),
          );
        await confirm(replaceManaged, 'Replace form Browser managed form');
        await user
          .getByRole('heading', {
            name: 'Browser managed form v2 · revision 2',
            exact: true,
          })
          .waitFor();
        checks(
          'Maintainer: actual YAML Issue Form creation and immutable replacement through production controls',
        );
        stage = 'Maintainer browser token expiry during new issue draft';
        await user
          .getByRole('link', { name: 'New issue', exact: true })
          .click();
        await user
          .getByLabel('Issue title (required)', { exact: true })
          .fill('Expired Staff draft');
        await user
          .getByLabel('Content (required)', { exact: true })
          .fill('Private expiry draft must clear');
        await user.clock.fastForward(901000);
        await user
          .getByText(
            'Sign in to submit an issue. Browsing public feedback does not require an account.',
            { exact: true },
          )
          .waitFor();
        assert.equal(await user.getByRole('textbox').count(), 0);
        assert.ok(
          !(await user.locator('body').innerText()).includes(
            'Private expiry draft must clear',
          ),
        );
        checks(
          'browser memory-token expiry timer clears an in-progress editor (browser clock fast-forward; backend time and immutable assurance unchanged)',
        );
      } else {
        await user
          .getByRole('link', { name: 'Manage project', exact: true })
          .click();
        stage = 'Administrator project settings and role controls';
        await user
          .locator('summary')
          .filter({ hasText: /^Project settings$/ })
          .click();
        const projectForm = await command(user, 'Save project settings');
        await projectForm
          .getByLabel('Project name (required)', { exact: true })
          .fill('Product workflows updated');
        await confirm(projectForm, 'Save project settings');
        await projectForm
          .getByText('Changes saved.', { exact: true })
          .waitFor();
        await user
          .locator('summary')
          .filter({ hasText: /^Staff roles$/ })
          .click();
        const grantForm = await command(user, 'Set Staff role');
        await grantForm
          .getByLabel('Staff principal ID (required)', { exact: true })
          .fill(options.principalIds.triager);
        await grantForm
          .getByLabel('Project role', { exact: true })
          .selectOption('triage');
        await confirm(grantForm, 'Set Staff role');
        await grantForm.getByText('Changes saved.', { exact: true }).waitFor();
        const removeForm = await command(user, 'Remove Staff membership');
        await removeForm
          .getByLabel('Staff principal ID (required)', { exact: true })
          .fill(options.principalIds.triager);
        await confirm(removeForm, 'Remove Staff membership');
        await removeForm.getByText('Changes saved.', { exact: true }).waitFor();
        checks(
          'Administrator: confirmed settings update and actual Staff role grant/removal under passkey assurance',
        );
        await user
          .getByRole('button', {
            name: 'Browse project audit trail (Administrator)',
            exact: true,
          })
          .click();
        await user
          .getByRole('heading', { name: 'Project audit trail', exact: true })
          .waitFor();
        await user.locator('.timeline > li').first().waitFor();
        assert.ok((await user.locator('.timeline > li').count()) <= 20);
        checks('Administrator: redacted audit browser');
        await user.getByRole('link', { name: 'Account', exact: true }).click();
        stage = 'Administrator actual plugin configuration and transitions';
        const pluginId = '@hyperbug/browser-fixture';
        await user.route('**/api/v1/admin/plugins', async (route) => {
          if (route.request().method() !== 'GET') return route.continue();
          const result = await user.request.post(
            options.apiOrigin + '/api/v1/admin/plugins',
            {
              headers: {
                origin: options.apiOrigin,
                authorization: route.request().headers().authorization,
              },
              data: {
                manifest: {
                  id: pluginId,
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
                      defaultValue: 'Local fixture',
                    },
                    { key: 'credential', kind: 'secret' },
                  ],
                  csp: {
                    scriptOrigins: [],
                    frameOrigins: [],
                    connectOrigins: ['https://example.com'],
                    imageOrigins: [],
                  },
                },
              },
            },
          );
          assert.ok([201, 409].includes(result.status()));
          return route.continue();
        });
        await user
          .getByRole('link', { name: 'Instance plugins', exact: true })
          .click();
        await user
          .getByRole('heading', { name: `${pluginId} · 1.0.0`, exact: true })
          .waitFor();
        await user.unroute('**/api/v1/admin/plugins');
        await user
          .getByRole('button', {
            name: `Load redacted settings for ${pluginId}`,
            exact: true,
          })
          .click();
        await user
          .getByText('caption · Public value: Local fixture', { exact: true })
          .waitFor();
        await user
          .locator('pre')
          .filter({ hasText: 'trusted-native' })
          .waitFor();
        const publicSetting = await command(user, `Save ${pluginId} caption`);
        await publicSetting
          .getByLabel('New public value as JSON scalar (required)', {
            exact: true,
          })
          .fill(JSON.stringify('Updated fixture'));
        await confirm(publicSetting, `Save ${pluginId} caption`);
        await publicSetting
          .getByText('Changes saved.', { exact: true })
          .waitFor();
        const secretSetting = await command(
          user,
          `Save ${pluginId} credential`,
        );
        const secret = 'local-fixture-value-' + crypto.randomUUID();
        await secretSetting
          .getByLabel('New secret value (write only) (required)', {
            exact: true,
          })
          .fill(secret);
        await confirm(secretSetting, `Save ${pluginId} credential`);
        await secretSetting
          .getByText('Changes saved.', { exact: true })
          .waitFor();
        assert.equal(await secretSetting.getByRole('textbox').inputValue(), '');
        await user
          .getByRole('button', {
            name: `Load redacted settings for ${pluginId}`,
            exact: true,
          })
          .click();
        await user
          .getByText('caption · Public value: Updated fixture', { exact: true })
          .waitFor();
        await user
          .getByText('credential · Secret configured (value unavailable)', {
            exact: true,
          })
          .waitFor();
        assert.ok(!(await user.locator('body').innerText()).includes(secret));
        await confirm(user, `Enable ${pluginId}`);
        await user
          .getByText(
            'Status: enabled. Disabled plugins do not provide their optional capabilities.',
            { exact: true },
          )
          .waitFor();
        await confirm(user, `Disable ${pluginId}`);
        await user
          .getByText(
            'Status: disabled. Disabled plugins do not provide their optional capabilities.',
            { exact: true },
          )
          .waitFor();
        await uniqueAssociations(user);
        checks(
          'Administrator: actual registered plugin, public/write-only secret settings, trust/CSP disclosure, enable and disable',
        );
        await auditAccessibility(
          user,
          'Administrator plugin public and secret controls',
        );
        stage = 'Administrator account session control';
        await user.getByRole('link', { name: 'Account', exact: true }).click();
        const revokeButton = user
          .getByRole('button', { name: /^Revoke session / })
          .first();
        const revokeName = await revokeButton.innerText();
        await confirm(user, revokeName);
        await user
          .getByRole('button', { name: revokeName, exact: true })
          .waitFor({ state: 'hidden' });
        await user
          .getByRole('button', { name: 'Check access', exact: true })
          .click();
        await user
          .getByText('Your access is current.', { exact: true })
          .waitFor();
        await user
          .getByRole('button', { name: 'Sign out of this app', exact: true })
          .click();
        await user
          .getByRole('dialog')
          .getByRole('button', { name: 'Sign out', exact: true })
          .click();
        await user
          .getByRole('heading', {
            name: 'Sign in to this instance.',
            exact: true,
          })
          .waitFor();
        checks(
          'Administrator: confirmed authorization-session revocation and separate app bearer sign-out',
        );
      }
    }
    assert.deepEqual(userErrors, []);
    const metrics = await user.evaluate(() => globalThis.metrics);
    assert.deepEqual(metrics.violations, []);
    report.metrics[handle] = metrics;
    const storage = await user.evaluate(() => ({
      local: localStorage.length,
      session: Object.keys(sessionStorage),
      databases:
        typeof indexedDB.databases === 'function' ? indexedDB.databases() : [],
    }));
    assert.equal(storage.local, 0);
    assert.ok(
      storage.session.every((key) =>
        key.startsWith('hyperbug.minimum-notice.v1:'),
      ),
    );
    checks(`${role}: credential-free persistent storage`);
    await context.close();
    const response = await fetch(options.controlOrigin + '/reindex', {
      method: 'POST',
    });
    assert.equal(response.status, 204);
  }
  if (axeSource) {
    const passed = accessibilityAudits.every(
      (audit) => audit.violations.length === 0,
    );
    await writeFile(
      `docs/plan/evidence/12-accessibility-${options.profile}.json`,
      JSON.stringify(
        {
          profile: options.profile,
          browser: browser.version(),
          tool: 'Standalone axe-core injected only by test instrumentation; no production dependency or disabled CSP',
          tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          manual:
            'Separate human evidence required; incomplete findings require review',
          passed,
          audits: accessibilityAudits,
        },
        null,
        2,
      ) + '\n',
    );
    assert.ok(passed, 'Automated accessibility violations require fixes');
  }
  report.passed = true;
  await writeFile(
    `docs/plan/evidence/12-browser-${options.profile}.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    `Local ${options.profile} browser workflows passed (${report.checks.length} checks).`,
  );
} catch (error) {
  await writeFile(
    `/tmp/hyperbug12-${options.profile}-network-failure.json`,
    JSON.stringify(report.httpErrors, null, 2),
  );
  if (activePage && !activePage.isClosed()) {
    await writeFile(
      `/tmp/hyperbug12-${options.profile}-failure.txt`,
      await activePage.locator('body').innerText(),
    );
    await activePage.screenshot({
      path: `/tmp/hyperbug12-${options.profile}-failure.png`,
    });
  }
  console.error(
    `Local browser failure at ${stage}: ${error.name}: ${error.message.split('\n').slice(0, 8).join(' ')}; ${error.stack?.split('\n').find((line) => line.includes('web-product-browser')) ?? ''}`,
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
