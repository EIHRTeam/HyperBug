import { scopeKeyProvider } from '@hyperbug/security';
import type {
  AccountPasswordStore,
  AccountSessionStore,
} from '@hyperbug/application';
import type { LoginRequest } from '@hyperbug/contracts';
import type { AccountPasswordService, KeyProvider } from '@hyperbug/security';
import { verifyAccountPassword } from './account-password.ts';
import { canonicalRegistrationHandle } from './account-registration.ts';
import { issueSessionCookieFor } from './account-session.ts';
import type { BoundSensitiveActionAdmission } from './sensitive-admission.ts';
import { RequestFailure } from './errors.ts';

const accountRule = Object.freeze({
  limit: 5,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});
const ipRule = Object.freeze({
  limit: 20,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});

/** Rate and optional CAPTCHA admission precede every password operation. */
export async function loginAccount(input: {
  readonly request: Request;
  readonly body: LoginRequest;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'require'>;
  readonly passwordService: AccountPasswordService | null;
  readonly passwordStore: AccountPasswordStore | null;
  readonly keyProvider: KeyProvider | null;
  readonly requestId?: string | null;
  readonly sessionStore: AccountSessionStore | null;
}): Promise<{
  cookie: string;
  principalId: string;
  identityId: string;
  authenticatedAtMs: number;
}> {
  const {
    request,
    body,
    admission,
    passwordService: rootPasswordService,
    passwordStore,
    keyProvider: rootProvider,
    sessionStore,
  } = input;
  const passwordService =
    rootPasswordService?.forRequest?.(request) ?? rootPasswordService;
  const keyProvider = rootProvider
    ? scopeKeyProvider(rootProvider, request)
    : null;
  if (!passwordService || !passwordStore || !keyProvider || !sessionStore)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  const handle = canonicalRegistrationHandle(body.handle);
  const nowMs = Date.now();
  await admission.require({
    request,
    category: 'login',
    checks: [
      { dimension: 'account', canonicalSubject: handle, rule: accountRule },
      { dimension: 'ip', rule: ipRule },
    ],
    nowMs,
    signal: request.signal,
    timeoutMs: 1000,
    captchaAction: 'login',
    ...(input.requestId === undefined || input.requestId === null
      ? {}
      : { requestId: input.requestId }),
    ...(body.captchaToken === undefined
      ? {}
      : { captchaToken: body.captchaToken }),
  });
  const account = await verifyAccountPassword({
    handle,
    password: body.password,
    service: passwordService,
    store: passwordStore,
    signal: request.signal,
    nowMs,
  });
  if (!account) throw new RequestFailure('LOGIN_DENIED');
  const cookie = await issueSessionCookieFor({
    account,
    ceremony: { method: 'password', assurance: 1 },
    provider: keyProvider,
    store: sessionStore,
    signal: request.signal,
    nowMs,
  });
  return {
    cookie,
    principalId: account.principalId,
    identityId: account.identityId,
    authenticatedAtMs: nowMs,
  };
}
