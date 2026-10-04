import { instanceId } from '@hyperbug/security';
import {
  decideEnable,
  decideRegistration,
  PLUGIN_API_VERSION,
  type PluginManifest,
} from '@hyperbug/plugin-api';
import type {
  OAuthAccessTokenStore,
  OAuthCodeStore,
} from '@hyperbug/application';
import {
  pluginRegistryView,
  publicTextOf,
  publicValueOf,
  pluginSettingView,
  type PluginSettingView,
  type PluginSettingsStore,
  type PluginRegistryRecord,
  type PluginRegistryStore,
  type PluginRegistryView,
} from '@hyperbug/application';
import type {
  AuthorizationPolicy,
  AuthorizationResolver,
  KeyProvider,
} from '@hyperbug/security';
import {
  auditEvent,
  CryptoFailure,
  encryptSecret,
  type SecretContext,
} from '@hyperbug/security';
import { authenticateBearer, type BearerPrincipal } from './bearer-auth.ts';
import { withAtomicAudit, auditRequestId } from './audit-emit.ts';
import type { AuditAppend } from './sensitive-admission.ts';
import { credentialFactsOf, requireAuthorizedAction } from './authorization.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

/** Everything the plugin-management handlers need, supplied by the app. */
export interface PluginManagementContext {
  readonly keyProvider: KeyProvider | null;
  readonly tokenStore: (OAuthCodeStore & OAuthAccessTokenStore) | null;
  readonly authorizationResolver: AuthorizationResolver | null;
  readonly authorizationPolicy: AuthorizationPolicy;
  readonly registry: PluginRegistryStore | null;
  readonly settings: PluginSettingsStore | null;
  readonly auditAppend: AuditAppend | null;
}

const storeTimeoutMs = 1_000;

/**
 * Plugin administration is deployment-level sensitive administration
 * (SECURITY §39) and uses the dedicated `instance:plugins.manage` permission
 * on the instance scope, so a project administrator gains no deployment
 * powers; the sensitive flag makes the evaluator require recent
 * authentication of the presented token.
 */
async function requirePluginAdministrator(
  request: Request,
  context: PluginManagementContext,
): Promise<BearerPrincipal> {
  const principal = await authenticateBearer(request, {
    keyProvider: context.keyProvider,
    tokenStore: context.tokenStore,
  });
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  if (!context.authorizationResolver || !context.registry)
    throw new RequestFailure('PLUGIN_UNAVAILABLE');
  await requireAuthorizedAction({
    httpRequest: request,
    request: {
      actorId: principal.principalId,
      permission: 'instance:plugins.manage',
      target: { projectId: instanceId, type: 'instance', id: instanceId },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
    credential: credentialFactsOf(principal),
  });
  return principal;
}

function registry(context: PluginManagementContext): PluginRegistryStore {
  if (!context.registry) throw new RequestFailure('PLUGIN_UNAVAILABLE');
  return context.registry;
}

function loadRecord(
  context: PluginManagementContext,
  request: Request,
  id: string,
): Promise<PluginRegistryRecord> {
  return withDeadline(request.signal, storeTimeoutMs, () =>
    registry(context).load(id),
  ).then((record) => {
    if (!record) throw new RequestFailure('NOT_FOUND');
    return record;
  });
}

function settings(context: PluginManagementContext): PluginSettingsStore {
  if (!context.settings) throw new RequestFailure('PLUGIN_UNAVAILABLE');
  return context.settings;
}

async function storedConfiguration(
  context: PluginManagementContext,
  request: Request,
  manifest: PluginManifest,
): Promise<{
  publicValues: Record<string, string | number | boolean>;
  secretPresent: string[];
}> {
  const rows = await withDeadline(request.signal, storeTimeoutMs, () =>
    settings(context).list(manifest.id),
  );
  const publicValues: Record<string, string | number | boolean> = {};
  const secretPresent: string[] = [];
  const declared = new Map(manifest.settings.map((s) => [s.key, s]));
  for (const row of rows) {
    const setting = declared.get(row.key);
    if (!setting || setting.kind !== row.kind)
      throw new RequestFailure('PLUGIN_STATE_CONFLICT');
    if (row.kind === 'secret') secretPresent.push(row.key);
    else if (setting.kind === 'public')
      publicValues[row.key] = publicValueOf(
        row.publicValue ?? '',
        setting.valueType,
      );
  }
  return { publicValues, secretPresent };
}

/** POST /api/v1/admin/plugins — register a validated manifest. */
export async function registerPlugin(
  request: Request,
  context: PluginManagementContext,
  manifestInput: unknown,
  requestId: string | null,
): Promise<PluginRegistryView> {
  const principal = await requirePluginAdministrator(request, context);
  const decision = decideRegistration({
    kind: 'register',
    manifest: manifestInput,
    hostApiVersion: PLUGIN_API_VERSION,
  });
  if (!decision.ok) throw new RequestFailure('PLUGIN_INVALID');
  const existing = await withDeadline(request.signal, storeTimeoutMs, () =>
    registry(context).load(decision.manifest.id),
  );
  if (existing) throw new RequestFailure('PLUGIN_STATE_CONFLICT');
  const nowMs = Date.now();
  const audit = auditEvent({
    id: crypto.randomUUID(),
    projectId: null,
    actorId: principal.principalId,
    systemActor: null,
    action: 'plugin.registered',
    targetId: decision.manifest.id,
    result: 'success',
    requestId: auditRequestId(requestId),
    createdAt: nowMs,
    metadata: { v: 1, version: decision.manifest.version },
  });
  const outcome = await withAtomicAudit(request.signal, storeTimeoutMs, () =>
    registry(context).insert(
      {
        id: decision.manifest.id,
        version: decision.manifest.version,
        state: 'registered',
        manifest: decision.manifest,
        registeredAtMs: nowMs,
        updatedAtMs: nowMs,
      },
      audit,
    ),
  );
  if (outcome === 'conflict') throw new RequestFailure('PLUGIN_STATE_CONFLICT');
  return pluginRegistryView({
    id: decision.manifest.id,
    version: decision.manifest.version,
    state: 'registered',
    manifest: decision.manifest,
    registeredAtMs: nowMs,
    updatedAtMs: nowMs,
  });
}

/** GET /api/v1/admin/plugins — bounded registry listing. */
export async function listPlugins(
  request: Request,
  context: PluginManagementContext,
): Promise<PluginRegistryView[]> {
  await requirePluginAdministrator(request, context);
  const records = await withDeadline(request.signal, storeTimeoutMs, () =>
    registry(context).list(),
  );
  return records.map(pluginRegistryView);
}

/**
 * POST /api/v1/admin/plugins/load — one registry entry. Plugin ids contain a
 * path separator, so they travel in the body rather than a path parameter.
 */
export async function loadPlugin(
  request: Request,
  context: PluginManagementContext,
  id: string,
): Promise<PluginRegistryView & { manifest: PluginManifest }> {
  await requirePluginAdministrator(request, context);
  const record = await loadRecord(context, request, id);
  return { ...pluginRegistryView(record), manifest: record.manifest };
}

/**
 * POST /api/v1/admin/plugins/:id/enable — requires complete configuration.
 * Configuration storage arrives with 05.2b; until then only plugins whose
 * manifest declares no settings can enable.
 */
export async function enablePlugin(
  request: Request,
  context: PluginManagementContext,
  id: string,
  requestId: string | null,
): Promise<PluginRegistryView> {
  const principal = await requirePluginAdministrator(request, context);
  const record = await loadRecord(context, request, id);
  const configuration = await storedConfiguration(
    context,
    request,
    record.manifest,
  );
  const decision = decideEnable({
    state: record.state,
    manifest: record.manifest,
    configuration,
  });
  if (!decision.ok) throw new RequestFailure('PLUGIN_STATE_CONFLICT');
  const audit = auditEvent({
    id: crypto.randomUUID(),
    projectId: null,
    actorId: principal.principalId,
    systemActor: null,
    action: 'plugin.enabled',
    targetId: id,
    result: 'success',
    requestId: auditRequestId(requestId),
    createdAt: Date.now(),
    metadata: { v: 1 },
  });
  const updated = await withAtomicAudit(request.signal, storeTimeoutMs, () =>
    registry(context).transition(
      {
        id,
        state: 'enabled',
        version: record.version,
        manifest: record.manifest,
        nowMs: Date.now(),
        expectedState: record.state,
      },
      audit,
    ),
  );
  if (!updated) throw new RequestFailure('PLUGIN_STATE_CONFLICT');
  return pluginRegistryView(updated);
}

/** POST /api/v1/admin/plugins/:id/disable */
export async function disablePlugin(
  request: Request,
  context: PluginManagementContext,
  id: string,
  requestId: string | null,
): Promise<PluginRegistryView> {
  const principal = await requirePluginAdministrator(request, context);
  const record = await loadRecord(context, request, id);
  if (record.state !== 'enabled')
    throw new RequestFailure('PLUGIN_STATE_CONFLICT');
  const audit = auditEvent({
    id: crypto.randomUUID(),
    projectId: null,
    actorId: principal.principalId,
    systemActor: null,
    action: 'plugin.disabled',
    targetId: id,
    result: 'success',
    requestId: auditRequestId(requestId),
    createdAt: Date.now(),
    metadata: { v: 1 },
  });
  const updated = await withAtomicAudit(request.signal, storeTimeoutMs, () =>
    registry(context).transition(
      {
        id,
        state: 'disabled',
        version: record.version,
        manifest: record.manifest,
        nowMs: Date.now(),
        expectedState: 'enabled',
      },
      audit,
    ),
  );
  if (!updated) throw new RequestFailure('PLUGIN_STATE_CONFLICT');
  return pluginRegistryView(updated);
}

/** POST /api/v1/admin/plugins/:id/upgrade — disabled/registered only, higher version. */
export async function upgradePlugin(
  request: Request,
  context: PluginManagementContext,
  id: string,
  manifestInput: unknown,
  requestId: string | null,
): Promise<PluginRegistryView> {
  const principal = await requirePluginAdministrator(request, context);
  const record = await loadRecord(context, request, id);
  const decision = decideRegistration({
    kind: 'upgrade',
    manifest: manifestInput,
    hostApiVersion: PLUGIN_API_VERSION,
    currentState: record.state,
    currentId: record.id,
    currentVersion: record.version,
  });
  if (!decision.ok) throw new RequestFailure('PLUGIN_INVALID');
  const audit = auditEvent({
    id: crypto.randomUUID(),
    projectId: null,
    actorId: principal.principalId,
    systemActor: null,
    action: 'plugin.upgraded',
    targetId: id,
    result: 'success',
    requestId: auditRequestId(requestId),
    createdAt: Date.now(),
    metadata: { v: 1, version: decision.manifest.version },
  });
  const updated = await withAtomicAudit(request.signal, storeTimeoutMs, () =>
    registry(context).transition(
      {
        id,
        state: record.state,
        version: decision.manifest.version,
        manifest: decision.manifest,
        nowMs: Date.now(),
        expectedState: record.state,
        expectedVersion: record.version,
      },
      audit,
    ),
  );
  if (!updated) throw new RequestFailure('PLUGIN_STATE_CONFLICT');
  return pluginRegistryView(updated);
}

/** POST /api/v1/admin/plugins/:id/uninstall — explicit retain-or-delete policy. */
export async function uninstallPlugin(
  request: Request,
  context: PluginManagementContext,
  id: string,
  policyInput: unknown,
  requestId: string | null,
): Promise<void> {
  const principal = await requirePluginAdministrator(request, context);
  const record = await loadRecord(context, request, id);
  // PLUGIN-SPEC §10.6: no default — the operator states the policy. Namespaced
  // data handling beyond the registry entry arrives with the storage
  // interfaces (05.2b); today the registry entry itself is the plugin's data.
  if (policyInput !== 'retain' && policyInput !== 'delete')
    throw new RequestFailure('PLUGIN_INVALID');
  const audit = auditEvent({
    id: crypto.randomUUID(),
    projectId: null,
    actorId: principal.principalId,
    systemActor: null,
    action: 'plugin.uninstalled',
    targetId: id,
    result: 'success',
    requestId: auditRequestId(requestId),
    createdAt: Date.now(),
    metadata: {
      v: 1,
      version: record.version,
      policy: policyInput,
    },
  });
  const removed = await withAtomicAudit(request.signal, storeTimeoutMs, () =>
    registry(context).remove(id, audit, policyInput === 'delete'),
  );
  if (!removed) throw new RequestFailure('NOT_FOUND');
}

/**
 * POST /api/v1/admin/plugins/configure — write configuration: public values
 * directly, secret values write-only and encrypted through the key provider
 * (SECURITY §121; PLUGIN-SPEC §§9.5, 10.3). Unknown keys and wrong types
 * answer PLUGIN_INVALID without storing anything.
 */
export async function configurePlugin(
  request: Request,
  context: PluginManagementContext,
  id: string,
  input: { values?: unknown; secrets?: unknown },
  requestId: string | null,
): Promise<PluginRegistryView> {
  const principal = await requirePluginAdministrator(request, context);
  const record = await loadRecord(context, request, id);
  const declared = new Map(record.manifest.settings.map((s) => [s.key, s]));
  const values = input.values ?? {};
  const secrets = input.secrets ?? {};
  if (typeof values !== 'object' || values === null || Array.isArray(values))
    throw new RequestFailure('PLUGIN_INVALID');
  if (typeof secrets !== 'object' || secrets === null || Array.isArray(secrets))
    throw new RequestFailure('PLUGIN_INVALID');
  const nowMs = Date.now();
  const existing = await withDeadline(request.signal, storeTimeoutMs, () =>
    settings(context).list(record.id),
  );
  const rowIds = new Map(existing.map((row) => [row.key, row.id]));
  const writes: {
    key: string;
    kind: 'public' | 'secret';
    rowId: string;
    record: unknown;
  }[] = [];
  for (const [key, value] of Object.entries(values)) {
    const setting = declared.get(key);
    if (!setting || setting.kind !== 'public')
      throw new RequestFailure('PLUGIN_INVALID');
    if (typeof value !== setting.valueType)
      throw new RequestFailure('PLUGIN_INVALID');
    writes.push({
      key,
      kind: 'public',
      rowId: rowIds.get(key) ?? crypto.randomUUID(),
      record: { publicValue: publicTextOf(value) },
    });
  }
  for (const [key, value] of Object.entries(secrets)) {
    const setting = declared.get(key);
    if (!setting || setting.kind !== 'secret')
      throw new RequestFailure('PLUGIN_INVALID');
    if (typeof value !== 'string' || value.length < 1 || value.length > 4096)
      throw new RequestFailure('PLUGIN_INVALID');
    if (!context.keyProvider) throw new RequestFailure('PLUGIN_UNAVAILABLE');
    // Envelopes bind to the stable row uuid — contextBytes requires a uuid
    // resource id — so a stored envelope can never be replayed onto another row.
    const rowId = rowIds.get(key) ?? crypto.randomUUID();
    const contextBinding: SecretContext = {
      resourceType: 'plugin-setting',
      resourceId: rowId,
      field: key,
      projectId: null,
      schemaVersion: 1,
    };
    let envelope: unknown;
    try {
      // Sequential by design: one key-provider round trip per secret avoids
      // concurrent current-key bursts on the registry.
      // eslint-disable-next-line no-await-in-loop
      envelope = await encryptSecret(
        context.keyProvider,
        new TextEncoder().encode(value),
        contextBinding,
      );
    } catch (error) {
      if (error instanceof CryptoFailure)
        throw new RequestFailure('PLUGIN_UNAVAILABLE');
      throw error;
    }
    writes.push({
      key,
      kind: 'secret',
      rowId,
      record: { secretRecord: envelope },
    });
  }
  const audit = auditEvent({
    id: crypto.randomUUID(),
    projectId: null,
    actorId: principal.principalId,
    systemActor: null,
    action: 'plugin.configured',
    targetId: id,
    result: 'success',
    requestId: auditRequestId(requestId),
    createdAt: nowMs,
    metadata: {
      v: 1,
      publicCount: writes.filter((write) => write.kind === 'public').length,
      secretCount: writes.filter((write) => write.kind === 'secret').length,
    },
  });
  await withAtomicAudit(request.signal, storeTimeoutMs, () =>
    settings(context).configure(
      writes.map((write) => ({
        id: write.rowId,
        pluginId: record.id,
        key: write.key,
        kind: write.kind,
        ...(write.kind === 'public'
          ? {
              publicValue: (write.record as { publicValue: string })
                .publicValue,
            }
          : {
              secretRecord: (write.record as { secretRecord: unknown })
                .secretRecord,
            }),
        updatedAtMs: nowMs,
      })),
      audit,
    ),
  );
  // Configuration audit carries counts only — no setting key or value ever
  // enters the audit trail (SECURITY §110–116 redaction baseline).
  return pluginRegistryView(record);
}

/**
 * POST /api/v1/admin/plugins/configuration — redacted read: public values in
 * their declared types, secrets only as presence (PLUGIN-SPEC §9.5).
 */
export async function readConfiguration(
  request: Request,
  context: PluginManagementContext,
  id: string,
): Promise<PluginSettingView[]> {
  await requirePluginAdministrator(request, context);
  const record = await loadRecord(context, request, id);
  const declared = new Map(record.manifest.settings.map((s) => [s.key, s]));
  const rows = await withDeadline(request.signal, storeTimeoutMs, () =>
    settings(context).list(record.id),
  );
  return rows.map((row) => {
    const setting = declared.get(row.key);
    if (!setting || setting.kind !== row.kind)
      throw new RequestFailure('PLUGIN_STATE_CONFLICT');
    return pluginSettingView(
      row,
      setting.kind === 'public' ? setting.valueType : undefined,
    );
  });
}
