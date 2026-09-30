import type { AccountPasswordStore } from '@hyperbug/application';
import type { StandardPasswordService } from '@hyperbug/security';
import { canonicalRegistrationHandle } from './account-registration.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

export interface VerifiedAccountPassword {
  readonly principalId: string;
  readonly identityId: string;
  readonly credentialRevision: number;
}

/** Internal account capability; a caller must revalidate before issuing a session. */
export async function verifyAccountPassword(input: {
  readonly handle: string;
  readonly password: string;
  readonly service: StandardPasswordService | null;
  readonly store: AccountPasswordStore | null;
  readonly signal: AbortSignal;
  readonly nowMs: number;
}): Promise<VerifiedAccountPassword | null> {
  const { service, store, signal, nowMs } = input;
  if (!service || !store) throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  const handle = canonicalRegistrationHandle(input.handle);
  try {
    const credential = await withDeadline(signal, 1000, () =>
      store.loadCredential(handle),
    );
    if (!credential) {
      // A missing handle still pays the selected Argon2id hash cost. The
      // result is discarded, and no account identity is disclosed.
      await withDeadline(signal, 5000, (bound) =>
        service.hash(input.password, bound),
      );
      return null;
    }
    const result = await withDeadline(signal, 5000, (bound) =>
      service.verify(input.password, credential.record, bound),
    );
    if (!result.verified) return null;
    let expectedRevision = credential.revision;
    if (result.replacement) {
      const replaced = await withDeadline(signal, 1000, () =>
        store.replaceCredential({
          identityId: credential.identityId,
          expectedRevision,
          record: result.replacement!,
          nowMs,
        }),
      );
      if (!replaced) throw new Error('Credential changed during verification');
      expectedRevision++;
    }
    const current = await withDeadline(signal, 1000, () =>
      store.loadCredential(handle),
    );
    if (
      !current ||
      current.identityId !== credential.identityId ||
      current.principalId !== credential.principalId ||
      current.revision !== expectedRevision
    )
      throw new Error('Credential changed during verification');
    return {
      principalId: current.principalId,
      identityId: current.identityId,
      credentialRevision: current.revision,
    };
  } catch {
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  }
}
