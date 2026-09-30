/**
 * Backend-owned authorization-service pages (04.2d). Server-rendered HTML on
 * the authorization origin only: semantic forms, visible labels, described
 * hints, aria-live error regions, language attribute, no scripts and no
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

export function contentSecurityPolicy(captcha: boolean): string {
  const provider = captcha
    ? '; script-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com'
    : '';
  return `default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'${provider}`;
}

function document(title: string, body: string, captcha: boolean): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
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
      'content-security-policy': contentSecurityPolicy(captcha),
    },
  });
}

function errorRegion(error: string | null): string {
  return error === null
    ? '<div id="form-error" aria-live="polite" class="error" hidden></div>'
    : `<div id="form-error" aria-live="assertive" class="error" role="alert">${escapeHtml(error)}</div>`;
}

export function authorizeLoginPage(input: {
  readonly query: AuthorizeQuery;
  readonly captchaRequired: boolean;
  readonly captchaSiteKey: string | null;
  readonly error: string | null;
}): Response {
  const { query, captchaRequired, captchaSiteKey, error } = input;
  const captcha = captchaRequired
    ? `<div class="field">
<label for="captchaToken">Verification</label>
<div class="cf-turnstile" data-sitekey="${escapeHtml(captchaSiteKey ?? '')}" data-action="login"></div>
<input type="hidden" name="captchaToken" id="captchaToken" aria-describedby="captcha-help">
<p id="captcha-help" class="hint">Complete the challenge to continue.</p>
</div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : // Turnstile's bootstrap loader is not SRI-pinnable (its bytes change on
      // Cloudflare's side); the exact-origin script-src pin above is the control.
      '';
  return document(
    'Sign in — HyperBug',
    `<h1>Sign in to continue</h1>
<p id="client-note" class="hint">The application <strong>${escapeHtml(query.client_id)}</strong> requests access to your HyperBug account.</p>
${errorRegion(error)}
<form method="POST" action="/auth/authorize/login">
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
</form>`,
    captchaRequired,
  );
}

export function authorizeConsentPage(input: {
  readonly query: AuthorizeQuery;
  readonly handle: string | null;
  readonly error: string | null;
}): Response {
  const { query, handle, error } = input;
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
${errorRegion(error)}
<form method="POST" action="/auth/authorize/consent">
${hiddenFields(query)}
<button type="submit">Authorize</button>
</form>`,
    false,
  );
}

export function authorizeErrorPage(message: string): Response {
  const response = document(
    'Request not permitted — HyperBug',
    `<h1>Authorization request not permitted</h1>
<p role="alert">${escapeHtml(message)}</p>`,
    false,
  );
  return new Response(response.body, {
    status: 400,
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
