import { verifyAccountPassword } from '../../packages/server/src/account-password.ts';
import type {
  AccountPasswordRecord,
  AccountPasswordStore,
  AccountRegistrationStore,
  Argon2idCredentialRecord,
} from '../../packages/application/src/account-registration.ts';
import type { StandardPasswordService } from '../../packages/security/src/standard-password.ts';

/**
 * Shared login-time rehash conformance fixture for checklist item 03.2e.
 *
 * Both standard profiles run this exact observation against their real
 * provider and their real primary store: a credential hashed under the
 * initial policy is verified through the actual login operation while the
 * bound service selects a superseding policy. Only the verification result is
 * transported, never a secret.
 */

/** The initial source-floor policy every production root selects today. */
export const rehashInitialParameters = Object.freeze({
  memoryKiB: 19456,
  passes: 2,
  parallelism: 1,
});

/** A superseding deployment policy; a stored initial record must rehash. */
export const rehashSupersededParameters = Object.freeze({
  memoryKiB: 20480,
  passes: 2,
  parallelism: 1,
});

export interface StandardPasswordRehashObservation {
  readonly initialLogin: 'issued' | 'denied' | 'unavailable';
  readonly initialRevision: number;
  readonly initialParameters: {
    readonly memoryKiB: number;
    readonly passes: number;
    readonly parallelism: number;
  };
  readonly rehashLogin: 'issued' | 'denied' | 'unavailable';
  readonly rehashRevision: number;
  readonly rehashedParameters: {
    readonly memoryKiB: number;
    readonly passes: number;
    readonly parallelism: number;
  } | null;
  readonly freshSalt: boolean;
  readonly freshVerifier: boolean;
  readonly repeatLogin: 'issued' | 'denied' | 'unavailable';
  readonly repeatRevision: number;
  readonly repeatStable: boolean;
  readonly wrongPassword: 'denied' | 'issued' | 'unavailable';
  readonly revisionAfterWrong: number;
}

async function attemptLogin(input: {
  readonly handle: string;
  readonly password: string;
  readonly service: StandardPasswordService;
  readonly store: AccountPasswordStore;
  readonly nowMs: number;
}): Promise<{
  outcome: 'issued' | 'denied' | 'unavailable';
  credentialRevision: number | null;
}> {
  try {
    const verified = await verifyAccountPassword({
      handle: input.handle,
      password: input.password,
      service: input.service,
      store: input.store,
      signal: new AbortController().signal,
      nowMs: input.nowMs,
    });
    return verified
      ? { outcome: 'issued', credentialRevision: verified.credentialRevision }
      : { outcome: 'denied', credentialRevision: null };
  } catch {
    return { outcome: 'unavailable', credentialRevision: null };
  }
}

/**
 * Run the rehash scenario and return only JSON-serializable facts so the same
 * helper executes inside a workerd fixture and inside a Node test process.
 */
export async function observeStandardPasswordRehash(input: {
  readonly store: AccountRegistrationStore & AccountPasswordStore;
  readonly initialService: StandardPasswordService;
  readonly supersededService: StandardPasswordService;
  readonly password: string;
  readonly nowMs: number;
}): Promise<StandardPasswordRehashObservation> {
  const { store, initialService, supersededService } = input;
  const handle = `rehash-${crypto.randomUUID().slice(0, 8)}`;
  const record = await initialService.hash(input.password);
  const registered = await store.register({
    principalId: crypto.randomUUID(),
    identityId: crypto.randomUUID(),
    handle,
    passwordRecord: record,
    nowMs: input.nowMs,
  });
  if (registered.status !== 'created') throw new Error('Registration failed');

  const initialLogin = await attemptLogin({
    handle,
    password: input.password,
    service: initialService,
    store,
    nowMs: input.nowMs + 1,
  });
  const initial = await store.loadCredential(handle);
  if (!initial) throw new Error('Initial credential is missing');

  const rehashLogin = await attemptLogin({
    handle,
    password: input.password,
    service: supersededService,
    store,
    nowMs: input.nowMs + 2,
  });
  const rehashed = await store.loadCredential(handle);
  if (!rehashed) throw new Error('Rehashed credential is missing');

  const repeatLogin = await attemptLogin({
    handle,
    password: input.password,
    service: supersededService,
    store,
    nowMs: input.nowMs + 3,
  });
  const repeat = await store.loadCredential(handle);
  if (!repeat) throw new Error('Repeated credential is missing');

  const wrongPassword = await attemptLogin({
    handle,
    password: `${input.password}!wrong`,
    service: supersededService,
    store,
    nowMs: input.nowMs + 4,
  });
  const afterWrong = await store.loadCredential(handle);
  if (!afterWrong) throw new Error('Credential vanished after denial');

  // This contract exercises the standard Argon2id rehash path only.
  const argon2 = (credential: AccountPasswordRecord) =>
    credential as Argon2idCredentialRecord;

  return {
    initialLogin: initialLogin.outcome,
    initialRevision: initial.revision,
    initialParameters: {
      memoryKiB: argon2(initial.record).memoryKiB,
      passes: argon2(initial.record).passes,
      parallelism: argon2(initial.record).parallelism,
    },
    rehashLogin: rehashLogin.outcome,
    rehashRevision: rehashed.revision,
    rehashedParameters: {
      memoryKiB: argon2(rehashed.record).memoryKiB,
      passes: argon2(rehashed.record).passes,
      parallelism: argon2(rehashed.record).parallelism,
    },
    freshSalt: rehashed.record.salt !== initial.record.salt,
    freshVerifier: rehashed.record.verifier !== initial.record.verifier,
    repeatLogin: repeatLogin.outcome,
    repeatRevision: repeat.revision,
    repeatStable:
      repeat.revision === rehashed.revision &&
      repeat.record.salt === rehashed.record.salt &&
      repeat.record.verifier === rehashed.record.verifier,
    wrongPassword: wrongPassword.outcome,
    revisionAfterWrong: afterWrong.revision,
  };
}

/** The single deterministic outcome both profiles must produce. */
export function expectedStandardPasswordRehashObservation(): StandardPasswordRehashObservation {
  return {
    initialLogin: 'issued',
    initialRevision: 1,
    initialParameters: rehashInitialParameters,
    rehashLogin: 'issued',
    rehashRevision: 2,
    rehashedParameters: rehashSupersededParameters,
    freshSalt: true,
    freshVerifier: true,
    repeatLogin: 'issued',
    repeatRevision: 2,
    repeatStable: true,
    wrongPassword: 'denied',
    revisionAfterWrong: 2,
  };
}
