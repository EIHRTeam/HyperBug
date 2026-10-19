import {
  CryptoFailure,
  cryptoRecord,
  decodeBase64Url,
  importProvidedKey,
  encodeBase64Url,
  parseKeyReference,
  sameKeyReference,
  type KeyProvider,
  type KeyPurpose,
  type KeyReference,
  type ProvidedKey,
} from './crypto.ts';

export interface KeyLifecycleSnapshot {
  readonly generation: number;
  readonly current: KeyReference;
  /** Revoked versions must be absent; current is first, followed by previous. */
  readonly readable: readonly KeyReference[];
  /** All still-needed data/backup versions, including quarantined revoked keys. */
  readonly required: readonly KeyReference[];
}
export interface KeyLifecycle {
  /** Fresh authoritative state. A local mutable flag is not a production ledger. */
  load(purpose: KeyPurpose, signal: AbortSignal): Promise<KeyLifecycleSnapshot>;
}
export interface SecretKeySource {
  read(signal: AbortSignal): Promise<string>;
}

export async function secretDocumentDigest(
  serialized: string,
): Promise<string> {
  if (
    typeof serialized !== 'string' ||
    serialized.length < 1 ||
    serialized.length > 16384
  )
    throw new CryptoFailure();
  const bytes = new TextEncoder().encode(serialized);
  try {
    return encodeBase64Url(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    );
  } finally {
    bytes.fill(0);
  }
}

function referenceId(ref: KeyReference): string {
  return JSON.stringify([ref.purpose, ref.id, ref.version]);
}

function snapshot(
  value: KeyLifecycleSnapshot,
  purpose: KeyPurpose,
): KeyLifecycleSnapshot {
  const record = cryptoRecord(value, [
    'generation',
    'current',
    'readable',
    'required',
  ]);
  if (
    !Number.isSafeInteger(record.generation) ||
    Number(record.generation) < 1 ||
    !Array.isArray(record.readable) ||
    record.readable.length < 1 ||
    record.readable.length > 32 ||
    !Array.isArray(record.required) ||
    record.required.length > 32
  )
    throw new CryptoFailure();
  const current = parseKeyReference(record.current, purpose);
  const readable = record.readable.map((ref) =>
    parseKeyReference(ref, purpose),
  );
  const required = record.required.map((ref) => parseKeyReference(ref));
  if (
    !readable[0] ||
    !sameKeyReference(current, readable[0]) ||
    new Set(readable.map(referenceId)).size !== readable.length ||
    new Set(required.map(referenceId)).size !== required.length
  )
    throw new CryptoFailure();
  return { generation: Number(record.generation), current, readable, required };
}

/** Strict secret-store document, separate from ordinary deployment policy/config. */
async function importRing(serialized: string): Promise<readonly ProvidedKey[]> {
  if (
    typeof serialized !== 'string' ||
    serialized.length < 1 ||
    serialized.length > 16384
  )
    throw new CryptoFailure();
  const root = cryptoRecord(JSON.parse(serialized), ['v', 'keys']);
  if (
    root.v !== 1 ||
    !Array.isArray(root.keys) ||
    root.keys.length < 1 ||
    root.keys.length > 32
  )
    throw new CryptoFailure();
  const raw = root.keys.map((entry) => {
    const record = cryptoRecord(entry, ['ref', 'material']);
    return {
      ref: parseKeyReference(record.ref),
      bytes: decodeBase64Url(record.material, 32, 32),
    };
  });
  try {
    if (new Set(raw.map((entry) => referenceId(entry.ref))).size !== raw.length)
      throw new CryptoFailure();
    // Detect accidental raw-key reuse with native timing-safe HMAC verification.
    // This ephemeral comparison key is never a credential or persistent key.
    const comparisonKey = await crypto.subtle.generateKey(
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign', 'verify'],
    );
    if (!('type' in comparisonKey) || comparisonKey.type !== 'secret')
      throw new CryptoFailure();
    const confirmations = await Promise.all(
      raw.map((entry) =>
        crypto.subtle.sign('HMAC', comparisonKey, entry.bytes),
      ),
    );
    const duplicates = await Promise.all(
      raw.flatMap((entry, index) =>
        confirmations
          .slice(0, index)
          .map((confirmation) =>
            crypto.subtle.verify(
              'HMAC',
              comparisonKey,
              confirmation,
              entry.bytes,
            ),
          ),
      ),
    );
    if (duplicates.some(Boolean)) throw new CryptoFailure();
    return await Promise.all(
      raw.map((entry) => importProvidedKey(entry.ref, entry.bytes)),
    );
  } finally {
    for (const entry of raw) entry.bytes.fill(0);
  }
}

/** Shared provider mechanism; source and authoritative lifecycle are runtime adapters. */
export class SecretKeyProvider implements KeyProvider {
  readonly #source: SecretKeySource;
  readonly #lifecycle: KeyLifecycle;
  readonly #timeoutMs: number;
  #material: { digest: string; keys: Promise<readonly ProvidedKey[]> } | null =
    null;
  readonly #selections = new Map<
    KeyPurpose,
    { digest: string; keys: readonly ProvidedKey[] }
  >();
  constructor(
    source: SecretKeySource,
    lifecycle: KeyLifecycle,
    timeoutMs = 1000,
  ) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 5000)
      throw new CryptoFailure();
    this.#source = source;
    this.#lifecycle = lifecycle;
    this.#timeoutMs = timeoutMs;
  }

  async #load(
    purpose: KeyPurpose,
  ): Promise<{ policy: KeyLifecycleSnapshot; keys: readonly ProvidedKey[] }> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new CryptoFailure());
      }, this.#timeoutMs);
    });
    try {
      return await Promise.race([
        timeout,
        (async () => {
          const [serialized, state] = await Promise.all([
            this.#source.read(controller.signal),
            this.#lifecycle.load(purpose, controller.signal),
          ]);
          if (controller.signal.aborted) throw new CryptoFailure();
          const policy = snapshot(state, purpose);
          const materialDigest = await secretDocumentDigest(serialized);
          if (controller.signal.aborted) throw new CryptoFailure();
          if (this.#material?.digest !== materialDigest) {
            const keys = importRing(serialized);
            this.#material = { digest: materialDigest, keys };
            this.#selections.clear();
            void keys.catch(() => {
              if (this.#material?.keys === keys) this.#material = null;
            });
          }
          const keys = await this.#material.keys;
          if (
            controller.signal.aborted ||
            [...policy.required, ...policy.readable].some(
              (ref) => !keys.some((key) => sameKeyReference(key.ref, ref)),
            )
          )
            throw new CryptoFailure();
          const selectionDigest =
            materialDigest +
            ':' +
            (await secretDocumentDigest(JSON.stringify(policy)));
          if (controller.signal.aborted) throw new CryptoFailure();
          const cached = this.#selections.get(purpose);
          if (cached?.digest === selectionDigest)
            return { policy, keys: cached.keys };
          const selectedKeys = Object.freeze(
            keys.filter((key) => key.ref.purpose === purpose),
          );
          this.#selections.set(purpose, {
            digest: selectionDigest,
            keys: selectedKeys,
          });
          return { policy, keys: selectedKeys };
        })(),
      ]);
    } catch {
      throw new CryptoFailure();
    } finally {
      clearTimeout(timer!);
      controller.abort();
    }
  }

  #view(
    load: (purpose: KeyPurpose) => Promise<{
      policy: KeyLifecycleSnapshot;
      keys: readonly ProvidedKey[];
    }>,
  ): KeyProvider {
    return {
      current: async (purpose) => {
        const { policy, keys } = await load(purpose);
        const key = keys.find((entry) =>
          sameKeyReference(entry.ref, policy.current),
        );
        if (!key) throw new CryptoFailure();
        return key;
      },
      get: async (ref) => {
        const reference = parseKeyReference(ref);
        const { policy, keys } = await load(reference.purpose);
        if (
          !policy.readable.some((entry) => sameKeyReference(entry, reference))
        )
          throw new CryptoFailure();
        const key = keys.find((entry) =>
          sameKeyReference(entry.ref, reference),
        );
        if (!key) throw new CryptoFailure();
        return key;
      },
      readable: async (purpose) => {
        const { policy, keys } = await load(purpose);
        return Object.freeze(
          policy.readable.map((ref) => {
            const key = keys.find((entry) => sameKeyReference(entry.ref, ref));
            if (!key) throw new CryptoFailure();
            return key;
          }),
        );
      },
    };
  }
  /** This view belongs to one caller-provided request scope. */
  requestScope(): KeyProvider {
    const loads = new Map<
      KeyPurpose,
      Promise<{ policy: KeyLifecycleSnapshot; keys: readonly ProvidedKey[] }>
    >();
    return Object.freeze(
      this.#view((purpose) => {
        let value = loads.get(purpose);
        if (!value) {
          value = this.#load(purpose);
          loads.set(purpose, value);
        }
        return value;
      }),
    );
  }
  current(purpose: KeyPurpose): Promise<ProvidedKey> {
    return this.#view((p) => this.#load(p)).current(purpose);
  }
  get(ref: KeyReference): Promise<ProvidedKey> {
    return this.#view((p) => this.#load(p)).get(ref);
  }
  readable(purpose: KeyPurpose): Promise<readonly ProvidedKey[]> {
    return this.#view((p) => this.#load(p)).readable(purpose);
  }
}

const requestProviders = new WeakMap<
  KeyProvider,
  WeakMap<object, KeyProvider>
>();
/** Only built-in providers share lifecycle state; arbitrary plugin providers keep their semantics. */
export function scopeKeyProvider(
  provider: KeyProvider,
  scope: object,
): KeyProvider {
  if (!(provider instanceof SecretKeyProvider)) return provider;
  let requests = requestProviders.get(provider);
  if (!requests) {
    requests = new WeakMap();
    requestProviders.set(provider, requests);
  }
  let scoped = requests.get(scope);
  if (!scoped) {
    scoped = provider.requestScope();
    requests.set(scope, scoped);
  }
  return scoped;
}
