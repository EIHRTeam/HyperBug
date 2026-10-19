/**
 * Backend-owned authorization-service pages (04.2d). Server-rendered HTML on
 * the authorization origin only: semantic forms, visible labels, described
 * hints, aria-live error regions, language attribute, optional fixed passkey script and no
 * inline styles — the UA default focus outline provides visible focus
 * (guides: forms, accessible-error-announcement; 2026-09-30 retrieval).
 */

export const oauthFields = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
] as const;

export interface AuthorizeQuery {
  readonly response_type: string;
  readonly client_id: string;
  readonly redirect_uri: string;
  readonly scope: string;
  readonly state: string;
  readonly code_challenge: string;
  readonly code_challenge_method: string;
}

/** Escape every interpolation; the query values are attacker-controlled. */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hiddenFields(query: AuthorizeQuery): string {
  return oauthFields
    .map(
      (field) =>
        `<input type="hidden" name="${field}" value="${escapeHtml(query[field])}">`,
    )
    .join('');
}

export function contentSecurityPolicy(
  captcha: boolean,
  validatedRedirectUri?: string,
  passkeys = false,
): string {
  // Callers must validate the exact registered URI before rendering. Serialize
  // only its web origin: paths/query text must never become CSP source tokens.
  const callback =
    validatedRedirectUri === undefined
      ? undefined
      : new URL(validatedRedirectUri);
  if (
    callback &&
    callback.protocol !== 'https:' &&
    callback.protocol !== 'http:'
  )
    throw new Error('Expected a validated web callback');
  const callbackOrigin = callback === undefined ? '' : ` ${callback.origin}`;
  const provider = `${passkeys || captcha ? `; script-src ${passkeys ? "'self' " : ''}${captcha ? 'https://challenges.cloudflare.com' : ''}; connect-src ${passkeys ? "'self' " : ''}${captcha ? 'https://challenges.cloudflare.com' : ''}` : ''}${captcha ? '; frame-src https://challenges.cloudflare.com' : ''}`;
  return `default-src 'none'; form-action 'self'${callbackOrigin}; base-uri 'none'; frame-ancestors 'none'${provider}`;
}

function document(
  title: string,
  body: string,
  captcha: boolean,
  validatedRedirectUri?: string,
  passkeys = false,
): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${passkeys ? '<script src="/auth/assets/passkeys.js" defer></script>' : ''}
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': contentSecurityPolicy(
        captcha,
        validatedRedirectUri,
        passkeys,
      ),
    },
  });
}

function errorRegion(error: string | null): string {
  return error === null
    ? '<div id="form-error" aria-live="polite" class="error" hidden></div>'
    : `<div id="form-error" aria-live="assertive" class="error" role="alert">${escapeHtml(error)}</div>`;
}

/** Persistent accessible notice for reduced-capability deployments. */
function noticeRegion(notice: string | null): string {
  return notice === null
    ? ''
    : `<div id="degradation-notice" class="notice" role="note">${escapeHtml(notice)}</div>`;
}

export function authorizeLoginPage(input: {
  readonly query: AuthorizeQuery;
  readonly captchaRequired: boolean;
  readonly captchaSiteKey: string | null;
  readonly error: string | null;
  /** When false, the credential form becomes an explained non-actionable state. */
  readonly passwordSigninAvailable: boolean;
  readonly passkeySigninAvailable?: boolean;
  /** Persistent degradation notice; null on standard deployments. */
  readonly notice: string | null;
}): Response {
  const {
    query,
    captchaRequired,
    captchaSiteKey,
    error,
    passwordSigninAvailable,
    notice,
  } = input;
  const captcha = captchaRequired
    ? `<fieldset aria-describedby="captcha-help">
<legend>Verification</legend>
<div class="cf-turnstile" data-sitekey="${escapeHtml(captchaSiteKey ?? '')}" data-action="login" data-response-field-name="captchaToken"></div>
<p id="captcha-help" class="hint">Complete the challenge to continue.</p>
</fieldset>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : // Turnstile's bootstrap loader is not SRI-pinnable (its bytes change on
      // Cloudflare's side); the exact-origin script-src pin above is the control.
      '';
  const passkeys = input.passkeySigninAvailable ?? false;
  const passkeyControls = passkeys
    ? '<p>For sensitive administration, use a verified passkey before authorizing access.</p><button type="button" id="passkey-login">Use a passkey</button><output id="passkey-status" aria-live="polite"></output>'
    : '';
  const credentials = passwordSigninAvailable
    ? `<form method="POST" action="/auth/authorize/login">
${hiddenFields(query)}
<fieldset>
<legend>Account credentials</legend>
<div class="field">
<label for="handle">Handle</label>
<input type="text" id="handle" name="handle" autocomplete="username" required aria-describedby="handle-help" maxlength="32">
<p id="handle-help" class="hint">Your account handle.</p>
</div>
<div class="field">
<label for="password">Password</label>
<input type="password" id="password" name="password" autocomplete="current-password" required minlength="12" maxlength="128" aria-describedby="password-help">
<p id="password-help" class="hint">At least 12 characters.</p>
</div>
${captcha}
</fieldset>
<button type="submit">Sign in</button>
</form>`
    : `<div id="signin-unavailable" class="notice" role="note">
<p>Password sign-in is unavailable on this instance.</p>
<p>Sign in through your application's passkey sign-in, or redeem a single-use recovery code.</p>
</div>`;
  return document(
    'Sign in — HyperBug',
    `<h1>Sign in to continue</h1>
<p id="client-note" class="hint">The application <strong>${escapeHtml(query.client_id)}</strong> requests access to your HyperBug account.</p>
${noticeRegion(notice)}
${errorRegion(error)}
${credentials}
${passkeyControls}
${!passwordSigninAvailable && passkeys ? captcha : ''}`,
    captchaRequired && (passwordSigninAvailable || passkeys),
    query.redirect_uri,
    passkeys,
  );
}

export function authorizeConsentPage(input: {
  readonly query: AuthorizeQuery;
  readonly handle: string | null;
  readonly error: string | null;
  readonly notice: string | null;
  readonly passkeySigninAvailable?: boolean;
  readonly captchaRequired?: boolean;
  readonly captchaSiteKey?: string | null;
}): Response {
  const { query, handle, error, notice } = input;
  const passkeys = input.passkeySigninAvailable ?? false;
  const scopes = query.scope
    .split(' ')
    .filter((token) => token.length > 0)
    .map((token) => `<li><code>${escapeHtml(token)}</code></li>`)
    .join('');
  return document(
    'Authorize application — HyperBug',
    `<h1>Authorize access</h1>
<p>Signed in${handle === null ? '' : ` as <strong>${escapeHtml(handle)}</strong>`}.</p>
<p>The application <strong>${escapeHtml(query.client_id)}</strong> asks for these scopes:</p>
<ul>${scopes}</ul>
${noticeRegion(notice)}
${errorRegion(error)}
${passkeys ? `<section aria-labelledby="passkey-heading"><h2 id="passkey-heading">Passkey verification</h2><p>Sensitive administration requires a recent verified passkey sign-in. Register a passkey for this account if needed, then use it before authorizing access.</p><button type="button" id="passkey-register">Register a passkey</button><button type="button" id="passkey-login">Use a passkey</button><output id="passkey-status" aria-live="polite"></output>${input.captchaRequired ? `<div class="cf-turnstile" data-sitekey="${escapeHtml(input.captchaSiteKey ?? '')}" data-action="login" data-response-field-name="captchaToken"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ''}</section>` : ''}
<form method="POST" action="/auth/authorize/consent">
${hiddenFields(query)}
<button type="submit">Authorize</button>
</form>`,
    passkeys && Boolean(input.captchaRequired),
    query.redirect_uri,
    passkeys,
  );
}

export function authorizeErrorPage(message: string, status = 400): Response {
  const response = document(
    'Request not permitted — HyperBug',
    `<h1>Authorization request not permitted</h1>
<p role="alert">${escapeHtml(message)}</p>`,
    false,
  );
  return new Response(response.body, {
    status,
    headers: response.headers,
  });
}

/**
 * RFC 6749 §4.2.2.1 / RFC 7636 §4.4.1 protocol rejection: unlike registry
 * failures, a request whose client and redirect URI already validated is
 * answered by redirecting the error (and state) back to that verified
 * redirect URI instead of rendering an error page.
 */
export function authorizeErrorRedirect(input: {
  readonly redirectUri: string;
  readonly error: 'unsupported_response_type' | 'invalid_request';
  readonly state: string;
}): Response {
  const parameters = new URLSearchParams({
    error: input.error,
    state: input.state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      location: `${input.redirectUri}${input.redirectUri.includes('?') ? '&' : '?'}${parameters.toString()}`,
    },
  });
}
