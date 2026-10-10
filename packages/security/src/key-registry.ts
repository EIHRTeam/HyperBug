import {
  CryptoFailure,
  cryptoRecord,
  parseKeyReference,
  parseProtectedValue,
  type CredentialDigest,
  type EncryptedSecret,
  type MinimumPasswordRecord,
  type KeyPurpose,
  type KeyReference,
} from './crypto.ts';
import type { KeyLifecycle, KeyLifecycleSnapshot } from './key-provider.ts';

export type ProtectedValue =
  | CredentialDigest
  | EncryptedSecret
  | MinimumPasswordRecord;
export interface RegistryVersion {
  readonly ref: KeyReference;
  readonly state: 'current' | 'previous' | 'revoked';
  readonly required: boolean;
}
export interface RegistrySnapshot {
  readonly generation: number;
  readonly keys: readonly RegistryVersion[];
}
export interface ProtectedRecord {
  readonly id: string;
  readonly revision: number;
  readonly record: ProtectedValue;
}
export interface RegistryMutation {
  readonly expectedGeneration: number;
  readonly auditId: string;
  readonly requestId: string;
  /** Trusted server clock, never a client-supplied retention override. */
  readonly now: number;
  readonly change:
    | {
        readonly kind: 'activate' | 'revoke' | 'remove';
        readonly key: KeyReference;
      }
    | {
        readonly kind: 'put';
        readonly id: string;
        readonly expectedRevision: number;
        readonly record: ProtectedValue;
      }
    | {
        readonly kind: 'delete';
        readonly id: string;
        readonly expectedRevision: number;
      }
    | {
        readonly kind: 'begin-backup';
        readonly id: string;
        readonly retainUntil: number;
      }
    | { readonly kind: 'finish-backup'; readonly id: string }
    | {
        readonly kind: 'release-backup';
        readonly id: string;
        readonly destroyed: true;
      };
}
/** Internal persistence capability; authentication/authorization precedes access.
 * Never expose this interface directly as an HTTP or plugin capability.
 */
export interface KeyRegistry extends KeyLifecycle {
  inspect(signal: AbortSignal): Promise<RegistrySnapshot>;
  mutate(intent: RegistryMutation): Promise<number>;
  getRecord(id: string, signal: AbortSignal): Promise<ProtectedRecord | null>;
}
export class KeyRegistryFailure extends Error {
  constructor() {
    super('Key registry operation failed');
    this.name = 'KeyRegistryFailure';
  }
}
export function registryId(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value,
    )
  )
    throw new KeyRegistryFailure();
}
function integer(
  value: unknown,
  min = 1,
  max = 2147483646,
): asserts value is number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw new KeyRegistryFailure();
}
/** Copy and validate before any asynchronous work, including untrusted runtime calls. */
export function registryMutation(value: RegistryMutation): RegistryMutation {
  try {
    const root = cryptoRecord(value, [
      'expectedGeneration',
      'auditId',
      'requestId',
      'now',
      'change',
    ]);
    integer(root.expectedGeneration);
    registryId(root.auditId);
    registryId(root.requestId);
    integer(root.now, 0, 8640000000000000);
    const candidate = root.change;
    if (!candidate || typeof candidate !== 'object' || !('kind' in candidate))
      throw new KeyRegistryFailure();
    let change: RegistryMutation['change'];
    switch (candidate.kind) {
      case 'activate':
      case 'revoke':
      case 'remove': {
        const c = cryptoRecord(candidate, ['kind', 'key']);
        change = { kind: candidate.kind, key: parseKeyReference(c.key) };
        break;
      }
      case 'put':
      case 'delete': {
        const c = cryptoRecord(
          candidate,
          candidate.kind === 'put'
            ? ['kind', 'id', 'expectedRevision', 'record']
            : ['kind', 'id', 'expectedRevision'],
        );
        registryId(c.id);
        integer(c.expectedRevision, candidate.kind === 'put' ? 0 : 1);
        change =
          candidate.kind === 'put'
            ? {
                kind: 'put',
                id: c.id,
                expectedRevision: c.expectedRevision,
                record: parseProtectedValue(c.record),
              }
            : {
                kind: 'delete',
                id: c.id,
                expectedRevision: c.expectedRevision,
              };
        break;
      }
      case 'begin-backup': {
        const c = cryptoRecord(candidate, ['kind', 'id', 'retainUntil']);
        registryId(c.id);
        integer(c.retainUntil, root.now + 1, 8640000000000000);
        change = { kind: 'begin-backup', id: c.id, retainUntil: c.retainUntil };
        break;
      }
      case 'finish-backup': {
        const c = cryptoRecord(candidate, ['kind', 'id']);
        registryId(c.id);
        change = { kind: 'finish-backup', id: c.id };
        break;
      }
      case 'release-backup': {
        const c = cryptoRecord(candidate, ['kind', 'id', 'destroyed']);
        registryId(c.id);
        if (c.destroyed !== true) throw new KeyRegistryFailure();
        change = { kind: 'release-backup', id: c.id, destroyed: true };
        break;
      }
      default:
        throw new KeyRegistryFailure();
    }
    return {
      expectedGeneration: root.expectedGeneration,
      auditId: root.auditId,
      requestId: root.requestId,
      now: root.now,
      change,
    };
  } catch {
    throw new KeyRegistryFailure();
  }
}

/** Normalize one consistent database snapshot; no raw material enters the registry. */
export function registrySnapshot(
  generation: unknown,
  keys: RegistryVersion[],
): RegistrySnapshot {
  integer(generation, 1, 2147483647);
  if (keys.length > 32) throw new KeyRegistryFailure();
  const normalized = keys.map((k) => {
    if (
      !['current', 'previous', 'revoked'].includes(k.state) ||
      typeof k.required !== 'boolean'
    )
      throw new KeyRegistryFailure();
    return {
      ref: parseKeyReference(k.ref),
      state: k.state,
      required: k.required,
    };
  });
  if (
    new Set(normalized.map((k) => JSON.stringify(k.ref))).size !==
    normalized.length
  )
    throw new KeyRegistryFailure();
  for (const purpose of [
    'token-hmac',
    'blind-index',
    'envelope-kek',
    'password-pepper',
  ]) {
    if (
      normalized.filter(
        (k) => k.ref.purpose === purpose && k.state === 'current',
      ).length > 1
    )
      throw new KeyRegistryFailure();
  }
  return { generation, keys: normalized };
}
export function registryLifecycle(
  state: RegistrySnapshot,
  purpose: KeyPurpose,
): KeyLifecycleSnapshot {
  const keys = state.keys.filter(
    (k) => k.ref.purpose === purpose && k.state !== 'revoked',
  );
  const current = keys.find((k) => k.state === 'current');
  if (!current) throw new CryptoFailure();
  return {
    generation: state.generation,
    current: current.ref,
    readable: [
      current.ref,
      ...keys.filter((k) => k !== current).map((k) => k.ref),
    ],
    required: state.keys.filter((k) => k.required).map((k) => k.ref),
  };
}
