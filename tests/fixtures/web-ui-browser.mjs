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
let stage = 'fixture';
let failure;
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    globalThis.violations = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      globalThis.violations.push(event.effectiveDirective),
    );
  });
  await page.goto(options.localOrigin + '/fixtures/ui.html');
  const field = page.getByLabel('Draft title (required)', { exact: true });
  await field.waitFor();
  stage = 'interaction validation and summary';
  assert.equal(await field.getAttribute('aria-invalid'), null);
  stage = 'initial typing stays neutral';
  await field.fill('a');
  assert.equal(await field.getAttribute('aria-invalid'), null);
  await field.press('Tab');
  assert.equal(await field.getAttribute('aria-invalid'), 'true');
  stage = 'correction clears old validation';
  await field.fill('A valid draft');
  await page.waitForFunction(
    () => document.querySelector('input').getAttribute('aria-invalid') === null,
  );
  assert.equal(await field.getAttribute('aria-invalid'), null);
  await field.fill('');
  await page
    .getByRole('button', { name: 'Validate draft', exact: true })
    .click();
  await page.waitForFunction(
    () => document.activeElement?.className === 'error-summary',
  );
  assert.equal(
    await page
      .locator('.error-summary [role=alert], .field-error[role=alert]')
      .count(),
    0,
  );
  await page.locator('.error-summary a').click();
  assert.equal(
    await field.evaluate((input) => input === document.activeElement),
    true,
  );
  const fieldSnapshot = await field.ariaSnapshot();
  stage = 'native modal keyboard focus';
  const open = page.getByRole('button', {
    name: 'Open confirmation',
    exact: true,
  });
  await open.focus();
  await open.press('Enter');
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  assert.equal(
    await cancel.evaluate((button) => button === document.activeElement),
    true,
  );
  const modalSnapshot = await page.locator('dialog').ariaSnapshot();
  await cancel.press('Tab');
  assert.equal(
    await page
      .getByRole('button', { name: 'Discard', exact: true })
      .evaluate((button) => button === document.activeElement),
    true,
  );
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog').open);
  assert.equal(
    await open.evaluate((button) => button === document.activeElement),
    true,
  );
  await open.click();
  await cancel.click();
  assert.equal(
    await open.evaluate((button) => button === document.activeElement),
    true,
  );
  stage = 'reflow, text zoom and motion';
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reflow = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animation: getComputedStyle(document.querySelector('button')).animationName,
  }));
  assert.ok(reflow.scrollWidth <= reflow.width);
  assert.equal(reflow.reducedMotion, true);
  assert.equal(reflow.animation, 'none');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const textZoom = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  // Test text enlargement at a normal viewport separately from 400% reflow.
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  stage = 'touch emulation';
  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  await touch.goto(options.localOrigin + '/fixtures/ui.html');
  await touch
    .getByRole('button', { name: 'Open confirmation', exact: true })
    .tap();
  await touch.getByRole('button', { name: 'Cancel', exact: true }).tap();
  assert.equal(
    await touch.locator('dialog').evaluate((dialog) => dialog.open),
    false,
  );
  const targetSizes = await touch
    .locator('button, input, nav a')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
  assert.ok(
    targetSizes
      .filter((size) => size.width > 0 && size.height > 0)
      .every((size) => size.width >= 24 && size.height >= 24),
  );
  const violations = await page.evaluate(() => globalThis.violations);
  assert.deepEqual(violations, []);
  await writeFile(
    'docs/plan/evidence/11-ui-browser.json',
    JSON.stringify(
      {
        environment:
          'real local Chrome; separately compiled test-only primitives; HTTP static host with real local Node public config',
        browser: browser.version(),
        initialNeutral: true,
        afterBlurInvalid: true,
        correctionClearsError: true,
        summaryFocusAndLink: true,
        duplicateLiveErrors: false,
        fieldSnapshot,
        modalSnapshot,
        modalInitialCancelFocus: true,
        escapeAndExplicitCancel: true,
        focusRestored: true,
        reflow,
        textZoom: {
          percent: 200,
          normalViewportNoOverflow: true,
          combined320Observation: textZoom,
        },
        touch: {
          emulated: true,
          viewport: [390, 844],
          dismiss: true,
          targetsAtLeast24: true,
        },
        cspViolations: violations,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Form, error focus, native dialog, reflow, reduced-motion and emulated touch checks passed.',
  );
} catch (error) {
  failure = `UI browser failure at ${stage}: ${error.name}; expected=${JSON.stringify(error.expected)}, actual=${JSON.stringify(error.actual)}; ${error.message.split('\n')[0].replace(/https?:\/\/[^\s]+/g, '[url]')}`;
} finally {
  await browser.close();
}
if (failure) throw new Error(failure);
