import { expect, it } from 'vitest';
import {
  authorizeLoginPage,
  authorizeConsentPage,
  contentSecurityPolicy,
} from '../../packages/server/src/authorize-pages.ts';
const query = {
  response_type: 'code',
  client_id: '<script>untrusted()</script>',
  redirect_uri: 'https://app.example.net/oauth/callback',
  scope: 'public-api',
  state: 'state',
  code_challenge: 'challenge',
  code_challenge_method: 'S256',
};
it('adds first-party passkey resources only to configured authorization pages without widening callback or provider sources', async () => {
  const page = authorizeLoginPage({
    query,
    captchaRequired: false,
    captchaSiteKey: null,
    error: null,
    passwordSigninAvailable: true,
    passkeySigninAvailable: true,
    notice: null,
  });
  const html = await page.text();
  expect(html).toContain(
    '<script src="/auth/assets/passkeys.js" defer></script>',
  );
  expect(html).toContain('id="passkey-login"');
  expect(html).not.toContain('id="passkey-register"');
  expect(html).not.toContain('<script>untrusted()');
  const csp = page.headers.get('content-security-policy')!;
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("form-action 'self' https://app.example.net");
  expect(csp).not.toContain('unsafe-');
  expect(csp).not.toContain('*');
  expect(contentSecurityPolicy(true, query.redirect_uri, true)).toContain(
    "script-src 'self' https://challenges.cloudflare.com",
  );
});
it('keeps unsupported pages script-free and registration on authenticated consent only', async () => {
  const unsupported = await authorizeLoginPage({
    query,
    captchaRequired: false,
    captchaSiteKey: null,
    error: null,
    passwordSigninAvailable: false,
    notice: null,
  }).text();
  expect(unsupported).not.toContain('/auth/assets/');
  expect(unsupported).not.toContain('id="passkey-login"');
  const consent = await authorizeConsentPage({
    query,
    handle: null,
    error: null,
    notice: null,
    passkeySigninAvailable: true,
  }).text();
  expect(consent).toContain('id="passkey-register"');
  expect(consent).toContain('recent verified passkey');
  expect(consent).toContain('action="/auth/authorize/consent"');
});
