/** Fixed first-party browser asset; no runtime user source or inline script. */
export const authPasskeyScript = String.raw`
'use strict';
(() => {
  const login = document.getElementById('passkey-login');
  const register = document.getElementById('passkey-register');
  const status = document.getElementById('passkey-status');
  const buttons = [login, register].filter(Boolean);
  function decode(value) {
    const text = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(text, character => character.charCodeAt(0));
  }
  function encode(value) {
    return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }
  async function post(path, body, signal) {
    const response = await fetch(path, { method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('application/json')) throw new Error('PASSKEY_UNAVAILABLE');
    const text = await response.text();
    if (text.length > 65536) throw new Error('INVALID_RESPONSE');
    return JSON.parse(text);
  }
  async function ceremony(create) {
    if (!globalThis.isSecureContext || !globalThis.PublicKeyCredential || !navigator.credentials) { status.textContent = 'Passkeys require a supported browser and a secure authorization origin.'; return; }
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60000);
    buttons.forEach(button => button.disabled = true);
    status.textContent = create ? 'Follow your device to register a passkey.' : 'Follow your device to sign in with a passkey.';
    try {
      const path = create ? '/auth/passkey/register' : '/auth/passkey/login';
      const options = await post(path + '/options', {}, controller.signal);
      const publicKey = { ...options, challenge: decode(options.challenge) };
      if (create) publicKey.user = { ...options.user, id: decode(options.user.id) };
      const descriptors = create ? 'excludeCredentials' : 'allowCredentials';
      if (options[descriptors]) publicKey[descriptors] = options[descriptors].map(entry => ({ ...entry, id: decode(entry.id) }));
      const credential = await navigator.credentials[create ? 'create' : 'get']({ publicKey, signal: controller.signal });
      if (!(credential instanceof PublicKeyCredential)) throw new Error('INVALID_CREDENTIAL');
      const source = credential.response;
      const response = { id: credential.id, rawId: encode(credential.rawId), type: credential.type, clientExtensionResults: credential.getClientExtensionResults(), ...(credential.authenticatorAttachment ? { authenticatorAttachment: credential.authenticatorAttachment } : {}), response: create
        ? { clientDataJSON: encode(source.clientDataJSON), attestationObject: encode(source.attestationObject), transports: source.getTransports?.() ?? [] }
        : { clientDataJSON: encode(source.clientDataJSON), authenticatorData: encode(source.authenticatorData), signature: encode(source.signature), userHandle: source.userHandle ? encode(source.userHandle) : null } };
      const captcha = document.querySelector('input[name="captchaToken"]')?.value;
      await post(path, { response, ...(!create && captcha ? { captchaToken: captcha } : {}) }, controller.signal);
      if (create) status.textContent = 'Passkey registered. Use the passkey sign-in button before authorizing sensitive actions.';
      else location.reload();
    } catch { status.textContent = 'The passkey operation was cancelled or could not complete. Try again, complete any required verification, or use another sign-in method.'; }
    finally { clearTimeout(timer); buttons.forEach(button => button.disabled = false); }
  }
  login?.addEventListener('click', () => { void ceremony(false); });
  register?.addEventListener('click', () => { void ceremony(true); });
})();
`;
