import { scopeKeyProvider } from '@hyperbug/security';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type {
  PasskeyStore,
  WebauthnChallengeStore,
} from '@hyperbug/application';
import { auditEvent } from '@hyperbug/security';
import {
  currentAccountSession,
  requireAuthOrigin,
  issueSessionCookieFor,
} from './account-session.ts';
import { appendRequiredAuditEvent, auditRequestId } from './audit-emit.ts';
import type {
  AuditAppend,
  BoundSensitiveActionAdmission,
} from './sensitive-admission.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

export interface PasskeyRelyingParty {
  readonly rpID: string;
  readonly rpName: string;
  readonly origin: string;
  readonly store: PasskeyStore & WebauthnChallengeStore;
  readonly passwordStore: {
    loadCredentialByIdentity(identityId: string): Promise<{
      principalId: string;
      identityId: string;
      revision: number;
    } | null>;
  };
  readonly sessionStore: NonNullable<
    Parameters<typeof issueSessionCookieFor>[0]['store']
  >;
  readonly keyProvider: NonNullable<
    Parameters<typeof issueSessionCookieFor>[0]['provider']
  >;
}

const challengeTtlMs = 5 * 60 * 1000;

/**
 * All-three-or-none parsing of the public relying-party values: a partial
 * selection refuses startup, none disarms every passkey route, and a
 * complete selection returns the triple for the root to bind to its stores.
 */
export function parsePasskeyConfiguration(input: {
  readonly rpId: string | undefined;
  readonly rpName: string | undefined;
  readonly origin: string | undefined;
}): Pick<PasskeyRelyingParty, 'rpID' | 'rpName' | 'origin'> | null {
  const configured = [input.rpId, input.rpName, input.origin].filter(
    (value) => value !== undefined,
  ).length;
  if (configured !== 0 && configured !== 3)
    throw new Error('Invalid passkey configuration');
  return configured === 3
    ? {
        rpID: input.rpId as string,
        rpName: input.rpName as string,
        origin: input.origin as string,
      }
    : null;
}

function decodeClientDataChallenge(response: {
  response: { clientDataJSON: string };
}): string {
  try {
    const decoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(
            response.response.clientDataJSON
              .replaceAll('-', '+')
              .replaceAll('_', '/'),
          ),
          (byte) => byte.charCodeAt(0),
        ),
      ),
    ) as { challenge?: unknown };
    if (
      typeof decoded.challenge !== 'string' ||
      decoded.challenge.length < 16 ||
      decoded.challenge.length > 256
    )
      throw new Error('Invalid challenge');
    return decoded.challenge;
  } catch {
    throw new RequestFailure('PASSKEY_DENIED');
  }
}

function identityUuidBytes(identityId: string): Uint8Array {
  const hex = identityId.replaceAll('-', '');
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1)
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

/** Session-authenticated registration options for a discoverable passkey. */
export async function passkeyRegistrationOptions(input: {
  readonly request: Request;
  readonly relyingParty: PasskeyRelyingParty | null;
  readonly nowMs: number;
}): Promise<unknown> {
  const { request, relyingParty } = input;
  requireAuthOrigin(request);
  if (!relyingParty) throw new RequestFailure('PASSKEY_UNAVAILABLE');
  const session = await currentAccountSession({
    request,
    provider: relyingParty.keyProvider
      ? scopeKeyProvider(relyingParty.keyProvider, request)
      : null,
    store: relyingParty.sessionStore,
    nowMs: input.nowMs,
  });
  if (!session) throw new RequestFailure('LOGIN_DENIED');
  const existing = await withDeadline(request.signal, 1000, () =>
    relyingParty.store.listCredentialIds(session.identityId),
  );
  const options = await generateRegistrationOptions({
    rpName: relyingParty.rpName,
    rpID: relyingParty.rpID,
    userName: session.identityId,
    userID: identityUuidBytes(session.identityId) as Uint8Array<ArrayBuffer>,
    timeout: challengeTtlMs,
    attestationType: 'none',
    excludeCredentials: existing.map((id) => ({ id })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });
  await withDeadline(request.signal, 1000, () =>
    relyingParty.store.create({
      kind: 'registration',
      challenge: options.challenge,
      identityId: session.identityId,
      nowMs: input.nowMs,
      expiresAtMs: input.nowMs + challengeTtlMs,
    }),
  );
  return options;
}

/** Verify a registration response against the identity's stored challenge. */
export async function passkeyRegistrationVerify(input: {
  readonly request: Request;
  readonly body: { response: RegistrationResponseJSON };
  readonly relyingParty: PasskeyRelyingParty | null;
  readonly auditAppend: AuditAppend | null;
  readonly requestId?: string | null;
  readonly nowMs: number;
}): Promise<{ registered: true }> {
  const { request, relyingParty, body, auditAppend } = input;
  requireAuthOrigin(request);
  if (!relyingParty) throw new RequestFailure('PASSKEY_UNAVAILABLE');
  const session = await currentAccountSession({
    request,
    provider: relyingParty.keyProvider
      ? scopeKeyProvider(relyingParty.keyProvider, request)
      : null,
    store: relyingParty.sessionStore,
    nowMs: input.nowMs,
  });
  if (!session) throw new RequestFailure('LOGIN_DENIED');
  const challenge = decodeClientDataChallenge(body.response);
  const owner = await withDeadline(request.signal, 1000, () =>
    relyingParty.store.consume('registration', challenge, input.nowMs),
  );
  if (owner === null || owner.identityId !== session.identityId)
    throw new RequestFailure('PASSKEY_DENIED');
  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: relyingParty.origin,
      expectedRPID: relyingParty.rpID,
      requireUserVerification: true,
    });
  } catch {
    throw new RequestFailure('PASSKEY_DENIED');
  }
  if (!verification.verified || !verification.registrationInfo)
    throw new RequestFailure('PASSKEY_DENIED');
  const info = verification.registrationInfo;
  const publicKey = btoa(String.fromCharCode(...info.credential.publicKey))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  await withDeadline(request.signal, 1000, () =>
    relyingParty.store.insertCredential({
      id: info.credential.id,
      identityId: session.identityId,
      publicKey,
      counter: info.credential.counter,
      transports: info.credential.transports ?? null,
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      aaguid: info.aaguid,
      nowMs: input.nowMs,
    }),
  );
  // Linking a credential to an account is the audited linking contract every
  // later identity-linking surface (SSO) must reuse.
  await appendRequiredAuditEvent({
    append: auditAppend,
    event: auditEvent({
      id: crypto.randomUUID(),
      projectId: null,
      actorId: session.principalId,
      systemActor: null,
      action: 'account.linked',
      targetId: session.identityId,
      result: 'success',
      requestId: auditRequestId(input.requestId),
      createdAt: input.nowMs,
      metadata: { v: 1, kind: 'passkey' },
    }),
    signal: request.signal,
  });
  return { registered: true };
}

/** Public discoverable-credential login options; challenge is stored once. */
export async function passkeyLoginOptions(input: {
  readonly request: Request;
  readonly relyingParty: PasskeyRelyingParty | null;
  readonly nowMs: number;
}): Promise<unknown> {
  requireAuthOrigin(input.request);
  if (!input.relyingParty) throw new RequestFailure('PASSKEY_UNAVAILABLE');
  const options = await generateAuthenticationOptions({
    rpID: input.relyingParty.rpID,
    timeout: challengeTtlMs,
    userVerification: 'required',
  });
  await withDeadline(input.request.signal, 1000, () =>
    input.relyingParty!.store.create({
      kind: 'authentication',
      challenge: options.challenge,
      identityId: null,
      nowMs: input.nowMs,
      expiresAtMs: input.nowMs + challengeTtlMs,
    }),
  );
  return options;
}

/** Verify an assertion and issue a first-party session for the principal. */
export async function passkeyLoginVerify(input: {
  readonly request: Request;
  readonly body: {
    response: AuthenticationResponseJSON;
    captchaToken?: string;
  };
  readonly admission: Pick<BoundSensitiveActionAdmission, 'require'>;
  readonly relyingParty: PasskeyRelyingParty | null;
  readonly nowMs: number;
  readonly requestId?: string | null;
}): Promise<string> {
  const { request, relyingParty, body } = input;
  requireAuthOrigin(request);
  if (!relyingParty) throw new RequestFailure('PASSKEY_UNAVAILABLE');
  const credentialId =
    typeof body.response?.id === 'string' &&
    /^[A-Za-z0-9_-]{1,1024}$/.test(body.response.id)
      ? body.response.id
      : null;
  if (!credentialId) throw new RequestFailure('PASSKEY_DENIED');
  await input.admission.require({
    request,
    category: 'login',
    checks: [
      {
        dimension: 'account',
        canonicalSubject: credentialId,
        rule: { limit: 10, windowMs: 3_600_000, retentionMs: 86_400_000 },
      },
      {
        dimension: 'ip',
        rule: { limit: 20, windowMs: 3_600_000, retentionMs: 86_400_000 },
      },
    ],
    nowMs: input.nowMs,
    signal: request.signal,
    timeoutMs: 1000,
    captchaAction: 'login',
    ...(body.captchaToken === undefined
      ? {}
      : { captchaToken: body.captchaToken }),
    ...(input.requestId === undefined || input.requestId === null
      ? {}
      : { requestId: input.requestId }),
  });
  const challenge = decodeClientDataChallenge(body.response);
  const consumed = await withDeadline(request.signal, 1000, () =>
    relyingParty.store.consume('authentication', challenge, input.nowMs),
  );
  if (consumed === null) throw new RequestFailure('PASSKEY_DENIED');
  const credential = await withDeadline(request.signal, 1000, () =>
    relyingParty.store.loadCredential(credentialId),
  );
  if (!credential) throw new RequestFailure('PASSKEY_DENIED');
  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: relyingParty.origin,
      expectedRPID: relyingParty.rpID,
      requireUserVerification: true,
      credential: {
        id: credential.id,
        publicKey: Uint8Array.from(
          atob(credential.publicKey.replaceAll('-', '+').replaceAll('_', '/')),
          (byte) => byte.charCodeAt(0),
        ),
        counter: credential.counter,
        ...(credential.transports
          ? { transports: [...credential.transports] }
          : {}),
      },
    });
  } catch {
    throw new RequestFailure('PASSKEY_DENIED');
  }
  if (!verification.verified) throw new RequestFailure('PASSKEY_DENIED');
  const advanced = await withDeadline(request.signal, 1000, () =>
    relyingParty.store.updateCounter(
      credential.id,
      verification.authenticationInfo.newCounter,
      input.nowMs,
    ),
  );
  if (!advanced) throw new RequestFailure('PASSKEY_DENIED');
  const account = await withDeadline(request.signal, 1000, () =>
    relyingParty.passwordStore.loadCredentialByIdentity(credential.identityId),
  );
  if (!account) throw new RequestFailure('LOGIN_DENIED');
  return issueSessionCookieFor({
    account: {
      principalId: account.principalId,
      identityId: account.identityId,
      credentialRevision: account.revision,
    },
    // A verified passkey ceremony carries assurance 2 for this session only.
    ceremony: { method: 'passkey', assurance: 2 },
    provider: relyingParty.keyProvider
      ? scopeKeyProvider(relyingParty.keyProvider, request)
      : null,
    store: relyingParty.sessionStore,
    signal: request.signal,
    nowMs: input.nowMs,
  });
}
