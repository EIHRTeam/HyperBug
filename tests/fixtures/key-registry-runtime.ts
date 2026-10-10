import {
  SecretKeyProvider,
  encodeBase64Url,
  encryptSecret,
  decryptSecret,
  rewrapSecret,
  hashMinimumPassword,
  verifyMinimumPassword,
  type KeyRegistry,
  type RegistryMutation,
  type KeyReference,
} from '../../packages/security/src/index.ts';

/** Runs inside each target runtime with its real database adapter. Never deployed. */
export async function keyRegistryRuntimeProof(
  registry: KeyRegistry,
): Promise<number> {
  const signal = () => new AbortController().signal;
  const first: KeyReference = {
    purpose: 'envelope-kek',
    id: 'runtime',
    version: 1,
  };
  const second: KeyReference = { ...first, version: 2 };
  const original = [first, second].map((ref) => ({
    ref,
    material: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
  }));
  let ring = original;
  const provider = new SecretKeyProvider(
    { read: async () => JSON.stringify({ v: 1, keys: ring }) },
    registry,
  );
  const apply = async (change: RegistryMutation['change']) =>
    registry.mutate({
      expectedGeneration: (await registry.inspect(signal())).generation,
      auditId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      now: 1789800000000,
      change,
    });
  let checks = 0;
  const check = (ok: boolean) => {
    if (!ok) throw new Error('Registry runtime proof failed');
    checks++;
  };
  const denied = async (work: () => Promise<unknown>) => {
    let failed = false;
    try {
      await work();
    } catch {
      failed = true;
    }
    check(failed);
  };
  await apply({ kind: 'activate', key: first });
  const context = {
    resourceType: 'runtime-fixture',
    resourceId: crypto.randomUUID(),
    field: 'secret',
    projectId: null,
    schemaVersion: 1,
  };
  const originalValue = await encryptSecret(
    provider,
    new Uint8Array([1, 2, 3]),
    context,
  );
  await apply({
    kind: 'put',
    id: context.resourceId,
    expectedRevision: 0,
    record: originalValue,
  });
  await apply({ kind: 'activate', key: second });
  await denied(() => apply({ kind: 'remove', key: first }));
  ring = original.slice(1);
  await denied(() => provider.current('envelope-kek'));
  ring = original;
  const next = await rewrapSecret(provider, originalValue, context);
  check(
    next.ciphertext === originalValue.ciphertext &&
      next.iv === originalValue.iv,
  );
  await apply({
    kind: 'put',
    id: context.resourceId,
    expectedRevision: 1,
    record: next,
  });
  await apply({ kind: 'remove', key: first });
  const saved = await registry.getRecord(context.resourceId, signal());
  check(saved?.revision === 2);
  check(
    JSON.stringify(
      Array.from(await decryptSecret(provider, saved?.record, context)),
    ) === '[1,2,3]',
  );
  await apply({ kind: 'revoke', key: second });
  await denied(() => decryptSecret(provider, saved?.record, context));
  await denied(() => apply({ kind: 'remove', key: second }));
  await apply({ kind: 'delete', id: context.resourceId, expectedRevision: 2 });
  await apply({ kind: 'remove', key: second });
  check(
    (await registry.inspect(signal())).keys.every(
      (k) => k.ref.id !== 'runtime',
    ),
  );
  return checks;
}

/** Password-pepper rotation with actual protected-record/reference persistence. */
export async function minimumPasswordRegistryProof(
  registry: KeyRegistry,
): Promise<number> {
  const signal = () => new AbortController().signal;
  const first: KeyReference = {
    purpose: 'password-pepper',
    id: 'minimum-runtime',
    version: 1,
  };
  const second: KeyReference = { ...first, version: 2 };
  const original = [first, second].map((ref) => ({
    ref,
    material: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
  }));
  const provider = new SecretKeyProvider(
    { read: async () => JSON.stringify({ v: 1, keys: original }) },
    registry,
  );
  let now = 1789800000000;
  const apply = async (change: RegistryMutation['change']) =>
    registry.mutate({
      expectedGeneration: (await registry.inspect(signal())).generation,
      auditId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      now,
      change,
    });
  let checks = 0;
  const check = (ok: boolean) => {
    if (!ok) throw new Error('Minimum password runtime proof failed');
    checks++;
  };
  const denied = async (work: () => Promise<unknown>) => {
    let failed = false;
    try {
      await work();
    } catch {
      failed = true;
    }
    check(failed);
  };
  await apply({ kind: 'activate', key: first });
  const context = {
    resourceType: 'public-user',
    resourceId: crypto.randomUUID(),
    field: 'password',
    projectId: null,
    schemaVersion: 1,
  };
  const password = 'correct horse battery staple';
  const initialPolicy = { currentIterations: 1000, maximumIterations: 1200 };
  const upgradedPolicy = { currentIterations: 1200, maximumIterations: 1200 };
  const initial = await hashMinimumPassword(
    provider,
    password,
    context,
    initialPolicy,
  );
  check(initial.key.version === 1 && initial.salt.length > 0);
  await apply({
    kind: 'put',
    id: context.resourceId,
    expectedRevision: 0,
    record: initial,
  });
  const backupId = crypto.randomUUID();
  await apply({
    kind: 'begin-backup',
    id: backupId,
    retainUntil: now + 86400000,
  });
  await apply({ kind: 'finish-backup', id: backupId });
  await apply({ kind: 'activate', key: second });
  await denied(() => apply({ kind: 'remove', key: first }));
  const saved = await registry.getRecord(context.resourceId, signal());
  const upgrade = await verifyMinimumPassword(
    provider,
    password,
    saved?.record,
    context,
    upgradedPolicy,
  );
  check(
    upgrade.verified &&
      upgrade.replacement?.key.version === 2 &&
      upgrade.replacement.iterations === 1200,
  );
  await apply({
    kind: 'put',
    id: context.resourceId,
    expectedRevision: 1,
    record: upgrade.replacement!,
  });
  await denied(() => apply({ kind: 'remove', key: first }));
  now += 86400001;
  await apply({ kind: 'release-backup', id: backupId, destroyed: true });
  await apply({ kind: 'remove', key: first });
  const next = await registry.getRecord(context.resourceId, signal());
  check(next?.revision === 2 && next.record.key.version === 2);
  const verified = await verifyMinimumPassword(
    provider,
    password,
    next?.record,
    context,
    upgradedPolicy,
  );
  check(verified.verified && verified.replacement === null);
  await apply({ kind: 'revoke', key: second });
  await denied(() =>
    verifyMinimumPassword(
      provider,
      password,
      next?.record,
      context,
      upgradedPolicy,
    ),
  );
  await denied(() => apply({ kind: 'remove', key: second }));
  await apply({ kind: 'delete', id: context.resourceId, expectedRevision: 2 });
  await apply({ kind: 'remove', key: second });
  check(
    (await registry.inspect(signal())).keys.every(
      (entry) => entry.ref.id !== 'minimum-runtime',
    ),
  );
  return checks;
}
