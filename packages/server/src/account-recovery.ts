import type {
  AccountPasswordStore,
  AccountRecoveryStore,
  AccountSessionStore,
} from '@hyperbug/application';
import type { RecoveryRequest } from '@hyperbug/contracts';
import {
  digestCredential,
  generateOpaqueCredential,
  verifyCredential,
  type KeyProvider,
  type SecretContext,
  type StandardPasswordService,
} from '@hyperbug/security';
import { canonicalRegistrationHandle } from './account-registration.ts';
import { currentAccountSession, requireAuthOrigin } from './account-session.ts';
import type { BoundSensitiveActionAdmission } from './sensitive-admission.ts';
import { withDeadline } from './bounds.ts';
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
const codeCount = 10;

function recoveryContext(identityId: string): SecretContext {
  return {
    resourceType: 'recovery-code',
    resourceId: identityId,
    field: 'code-secret',
    projectId: null,
    schemaVersion: 1,
  } as const;
}

/**
 * Session-authenticated generation of a fresh single-use recovery-code set.
 * The plaintext codes are returned exactly once; only keyed digests persist,
 * and regeneration deletes the previous generation entirely.
 */
export async function generateAccountRecoveryCodes(input: {
  readonly request: Request;
  readonly keyProvider: KeyProvider | null;
  readonly recoveryStore: AccountRecoveryStore | null;
  readonly sessionStore: AccountSessionStore | null;
  readonly nowMs: number;
}): Promise<{ codes: string[] }> {
  const { request, keyProvider, recoveryStore, sessionStore, nowMs } = input;
  requireAuthOrigin(request);
  if (!keyProvider || !recoveryStore || !sessionStore)
    throw new RequestFailure('RECOVERY_UNAVAILABLE');
  const session = await currentAccountSession({
    request,
    provider: keyProvider,
    store: sessionStore,
    nowMs,
  });
  if (!session) throw new RequestFailure('LOGIN_DENIED');
  const context = recoveryContext(session.identityId);
  const codes = Array.from({ length: codeCount }, () =>
    generateOpaqueCredential(),
  );
  try {
    const digests = await Promise.all(
      codes.map((code) => digestCredential(keyProvider, code, context)),
    );
    if (request.signal.aborted) throw new Error('Aborted');
    await withDeadline(request.signal, 5000, () =>
      recoveryStore.replaceCodes({
        identityId: session.identityId,
        digests: digests.map((digest) => JSON.stringify(digest)),
        nowMs,
      }),
    );
  } catch {
    throw new RequestFailure('RECOVERY_UNAVAILABLE');
  }
  return { codes };
}

/**
 * Redeem one recovery code to set a new password. The response is the same
 * generic denial for an unknown handle, a wrong or used code, and a revision
 * race, so the endpoint reveals none of them; a consumed code stays consumed
 * even when the later password replacement loses its race.
 */
export async function recoverAccount(input: {
  readonly request: Request;
  readonly body: RecoveryRequest;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'require'>;
  readonly password: StandardPasswordService | null;
  readonly passwordStore: AccountPasswordStore | null;
  readonly recoveryStore: AccountRecoveryStore | null;
  readonly sessionStore: AccountSessionStore | null;
  readonly keyProvider: KeyProvider | null;
  readonly requestId?: string | null;
}): Promise<{ recovered: true }> {
  const {
    request,
    body,
    admission,
    password,
    passwordStore,
    recoveryStore,
    sessionStore,
    keyProvider,
  } = input;
  requireAuthOrigin(request);
  if (!password || !passwordStore || !recoveryStore || !sessionStore)
    throw new RequestFailure('RECOVERY_UNAVAILABLE');
  if (!keyProvider) throw new RequestFailure('RECOVERY_UNAVAILABLE');
  const handle = canonicalRegistrationHandle(body.handle);
  const nowMs = Date.now();
  await admission.require({
    request,
    category: 'password-reset',
    checks: [
      { dimension: 'account', canonicalSubject: handle, rule: accountRule },
      { dimension: 'ip', rule: ipRule },
    ],
    nowMs,
    signal: request.signal,
    timeoutMs: 1000,
    captchaAction: 'password-reset',
    ...(input.requestId === undefined || input.requestId === null
      ? {}
      : { requestId: input.requestId }),
  });
  const credential = await withDeadline(request.signal, 1000, () =>
    passwordStore.loadCredential(handle),
  );
  if (!credential) {
    // Equalize the timing profile with a real digest verification.
    const context = recoveryContext('00000000-0000-4000-8000-000000000000');
    const decoy = await withDeadline(request.signal, 1000, () =>
      digestCredential(keyProvider, generateOpaqueCredential(), context),
    );
    await withDeadline(request.signal, 1000, () =>
      verifyCredential(
        keyProvider,
        typeof body.recoveryCode === 'string' && body.recoveryCode.length <= 128
          ? body.recoveryCode
          : generateOpaqueCredential(),
        JSON.stringify(decoy),
        context,
      ),
    );
    throw new RequestFailure('RECOVERY_DENIED');
  }
  const context = recoveryContext(credential.identityId);
  const active = await withDeadline(request.signal, 1000, () =>
    recoveryStore.listActive(credential.identityId),
  );
  let consumedId: string | null = null;
  for (const record of active) {
    // Sequential verification stops at the first match without a timing signal.
    // eslint-disable-next-line no-await-in-loop
    const valid = await withDeadline(request.signal, 1000, () =>
      verifyCredential(
        keyProvider,
        body.recoveryCode,
        JSON.parse(record.digest),
        context,
      ),
    );
    if (!valid) continue;
    // eslint-disable-next-line no-await-in-loop
    const consumed = await withDeadline(request.signal, 1000, () =>
      recoveryStore.consume(record.id, nowMs),
    );
    if (consumed) {
      consumedId = record.id;
      break;
    }
  }
  if (!consumedId || request.signal.aborted)
    throw new RequestFailure('RECOVERY_DENIED');
  try {
    const passwordRecord = await withDeadline(request.signal, 5000, (signal) =>
      password.hash(body.password, signal),
    );
    if (request.signal.aborted) throw new RequestFailure('RECOVERY_DENIED');
    const replaced = await withDeadline(request.signal, 5000, () =>
      passwordStore.replaceCredential({
        identityId: credential.identityId,
        expectedRevision: credential.revision,
        record: passwordRecord,
        nowMs,
      }),
    );
    if (!replaced) throw new RequestFailure('RECOVERY_DENIED');
    await withDeadline(request.signal, 1000, () =>
      sessionStore.revokeAllForPrincipal(credential.principalId, nowMs),
    );
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('RECOVERY_UNAVAILABLE');
  }
  return { recovered: true };
}
