import { securityDecisionTimeoutMs } from './bounds.ts';
import type { AccountRegistrationStore } from '@hyperbug/application';
import type { RegistrationRequest } from '@hyperbug/contracts';
import type { AccountPasswordService } from '@hyperbug/security';
import type { BoundSensitiveActionAdmission } from './sensitive-admission.ts';
import { storeWriteTimeoutMs, withDeadline } from './bounds.ts';
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

/** Account identity is exact lowercase ASCII, shared by lookup and abuse keys. */
export function canonicalRegistrationHandle(value: string): string {
  if (typeof value !== 'string') throw new RequestFailure('INVALID_REQUEST');
  const handle = value.toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(handle))
    throw new RequestFailure('INVALID_REQUEST');
  return handle;
}

export async function registerAccount(input: {
  readonly request: Request;
  readonly body: RegistrationRequest;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'require'>;
  readonly password: AccountPasswordService | null;
  readonly requestId?: string | null;
  readonly store: AccountRegistrationStore | null;
}): Promise<{ accepted: true }> {
  const { request, body, admission, password: rootPassword, store } = input;
  const password = rootPassword?.forRequest?.(request) ?? rootPassword;
  if (!password || !store) throw new RequestFailure('REGISTRATION_UNAVAILABLE');
  if (password.acceptsNewPassword?.(body.password) === false)
    throw new RequestFailure('INVALID_REQUEST');
  const handle = canonicalRegistrationHandle(body.handle);
  const nowMs = Date.now();
  await admission.require({
    request,
    category: 'registration',
    checks: [
      { dimension: 'account', canonicalSubject: handle, rule: accountRule },
      { dimension: 'ip', rule: ipRule },
    ],
    nowMs,
    signal: request.signal,
    timeoutMs: securityDecisionTimeoutMs(request.signal),
    captchaAction: 'register',
    ...(input.requestId === undefined || input.requestId === null
      ? {}
      : { requestId: input.requestId }),
    ...(body.captchaToken === undefined
      ? {}
      : { captchaToken: body.captchaToken }),
  });
  try {
    const passwordRecord = await withDeadline(request.signal, 5000, (signal) =>
      password.hash(body.password, signal),
    );
    if (request.signal.aborted)
      throw new RequestFailure('REGISTRATION_UNAVAILABLE');
    const principalId = crypto.randomUUID();
    // A stalled persistence adapter cannot leave the HTTP action open forever.
    // An already-dispatched D1 batch may still commit after this deadline.
    const outcome = await withDeadline(
      request.signal,
      storeWriteTimeoutMs(request.signal),
      () =>
        store.register({
          principalId,
          identityId: crypto.randomUUID(),
          handle,
          passwordRecord,
          nowMs,
        }),
    );
    if (
      outcome?.status !== 'existing' &&
      (outcome?.status !== 'created' || outcome.principalId !== principalId)
    )
      throw new Error('Invalid registration outcome');
  } catch {
    throw new RequestFailure('REGISTRATION_UNAVAILABLE');
  }
  return { accepted: true };
}
