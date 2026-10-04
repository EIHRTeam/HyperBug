import {
  authorize,
  isPermission,
  type AuthorizationDecision,
  type AuthorizationPolicy,
  type AuthorizationResolver,
  type PermissionRequest,
  type ResourceType,
} from './authorization.ts';
import {
  decodeBase64Url,
  encodeBase64Url,
  parseKeyReference,
} from './crypto.ts';

export class AuditFailure extends Error {
  readonly code: 'AUDIT_INVALID' | 'AUDIT_FORBIDDEN' | 'AUDIT_UNAVAILABLE';
  constructor(code: AuditFailure['code'] = 'AUDIT_UNAVAILABLE') {
    super(code);
    this.code = code;
  }
}
const invalid = () => new AuditFailure('AUDIT_INVALID');
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const resourceTypes: readonly ResourceType[] = [
  'project',
  'issue',
  'comment',
  'audit',
  'plugin',
  'secret',
  'key',
  'export',
];
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !uuid.test(value)) throw invalid();
}
function integer(
  value: unknown,
  min: number,
  max: number,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw invalid();
}
function record(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw invalid();
  const keys = Object.keys(value);
  if (
    keys.length !== fields.length ||
    keys.some((key) => !fields.includes(key))
  )
    throw invalid();
  return value as Record<string, unknown>;
}

const projectActions = ['issue.created', 'issue.edited'] as const;
const registryActions = [
  'activate',
  'revoke',
  'remove',
  'put',
  'delete',
  'begin-backup',
  'finish-backup',
  'release-backup',
] as const;
const accountActions = [
  'account.enrolled',
  'account.linked',
  'account.recovered',
  'recovery.generated',
  'session.revoked',
] as const;
const administrationActions = [
  'role.granted',
  'role.revoked',
  'principal.suspended',
  'principal.activated',
] as const;
const pluginActions = [
  'plugin.registered',
  'plugin.enabled',
  'plugin.disabled',
  'plugin.upgraded',
  'plugin.uninstalled',
  'plugin.configured',
] as const;
/** Runtime mirror of StaffRole for the closed role.granted metadata. */
const staffRoles = ['triage', 'maintainer', 'administrator'] as const;
export type AuditAction =
  | (typeof projectActions)[number]
  | `key-registry.${(typeof registryActions)[number]}`
  | (typeof accountActions)[number]
  | (typeof administrationActions)[number]
  | (typeof pluginActions)[number]
  | 'authorization.checked'
  | 'provider.outage'
  | 'deployment.enablement'
  | 'instance-role.backfilled';
export interface AuditEvent {
  readonly id: string;
  readonly projectId: string | null;
  readonly actorId: string | null;
  readonly systemActor:
    | 'core.key-registry'
    | 'core.authorization'
    | 'core.admission'
    | 'core.deployment'
    | 'core.identity'
    | null;
  readonly action: AuditAction;
  readonly targetId: string;
  readonly result: 'success' | 'failure';
  readonly requestId: string;
  readonly createdAt: number;
  readonly metadata: Readonly<Record<string, string | number>>;
}

/** Closed catalog: extend with an owning feature, never with arbitrary metadata. */
export function auditEvent(input: unknown): AuditEvent {
  try {
    const r = record(input, [
      'id',
      'projectId',
      'actorId',
      'systemActor',
      'action',
      'targetId',
      'result',
      'requestId',
      'createdAt',
      'metadata',
    ]);
    id(r.id);
    id(r.requestId);
    integer(r.createdAt, 0, 8640000000000000);
    if (r.projectId !== null) id(r.projectId);
    if (r.actorId !== null) id(r.actorId);
    if (r.result !== 'success' && r.result !== 'failure') throw invalid();
    let metadata: Readonly<Record<string, string | number>>;
    if ((projectActions as readonly unknown[]).includes(r.action)) {
      if (
        r.projectId === null ||
        r.actorId === null ||
        r.systemActor !== null ||
        r.result !== 'success'
      )
        throw invalid();
      id(r.targetId);
      record(r.metadata, []);
      metadata = Object.freeze({});
    } else if (r.action === 'authorization.checked') {
      if (
        r.projectId === null ||
        (r.actorId === null
          ? r.systemActor !== 'core.authorization'
          : r.systemActor !== null)
      )
        throw invalid();
      id(r.targetId);
      const m = record(r.metadata, [
        'v',
        'permission',
        'resourceType',
        'decision',
      ]);
      if (
        m.v !== 1 ||
        !isPermission(m.permission) ||
        !(resourceTypes as readonly unknown[]).includes(m.resourceType) ||
        typeof m.decision !== 'string' ||
        ![
          'allowed',
          'forbidden',
          'reauthentication_required',
          'unavailable',
        ].includes(m.decision) ||
        (r.result === 'success') !== (m.decision === 'allowed')
      )
        throw invalid();
      metadata = Object.freeze({
        v: 1,
        permission: m.permission,
        resourceType: m.resourceType as string,
        decision: m.decision as string,
      });
    } else if (r.action === 'instance-role.backfilled') {
      if (
        r.projectId !== null ||
        r.actorId !== null ||
        r.systemActor !== 'core.deployment' ||
        r.result !== 'success'
      )
        throw invalid();
      id(r.targetId);
      const grant = record(r.metadata, ['v', 'role']);
      if (grant.v !== 1 || grant.role !== 'instance-administrator')
        throw invalid();
      metadata = Object.freeze({ v: 1, role: 'instance-administrator' });
    } else if (r.action === 'deployment.enablement') {
      if (
        r.projectId !== null ||
        r.actorId !== null ||
        r.systemActor !== 'core.deployment' ||
        r.targetId !== 'cloudflare-free-minimum'
      )
        throw invalid();
      const enablement = record(r.metadata, [
        'v',
        'acknowledgement',
        'outcome',
      ]);
      if (
        enablement.v !== 1 ||
        enablement.acknowledgement !== 'free-minimum-v1' ||
        (enablement.outcome !== 'refused' &&
          enablement.outcome !== 'enabled') ||
        (r.result === 'success') !== (enablement.outcome === 'enabled')
      )
        throw invalid();
      metadata = Object.freeze({
        v: 1,
        acknowledgement: enablement.acknowledgement,
        outcome: enablement.outcome,
      });
    } else if (r.action === 'provider.outage') {
      if (
        r.projectId !== null ||
        r.actorId !== null ||
        r.systemActor !== 'core.admission' ||
        r.result !== 'failure'
      )
        throw invalid();
      if (typeof r.targetId !== 'string' || r.targetId.length > 192)
        throw invalid();
      const outage: unknown = JSON.parse(r.targetId);
      if (
        !Array.isArray(outage) ||
        outage.length !== 2 ||
        outage[0] !== 'turnstile' ||
        typeof outage[1] !== 'string' ||
        !/^[a-z][a-z0-9:_-]{0,63}$/.test(outage[1]) ||
        JSON.stringify([outage[0], outage[1]]) !== r.targetId
      )
        throw invalid();
      const outageMetadata = record(r.metadata, ['v', 'outcome']);
      if (outageMetadata.v !== 1 || outageMetadata.outcome !== 'unavailable')
        throw invalid();
      metadata = Object.freeze({ v: 1, outcome: 'unavailable' });
    } else if (
      typeof r.action === 'string' &&
      registryActions.some((action) => r.action === `key-registry.${action}`)
    ) {
      if (
        r.projectId !== null ||
        r.actorId !== null ||
        r.systemActor !== 'core.key-registry' ||
        r.result !== 'success'
      )
        throw invalid();
      const m = record(r.metadata, ['v', 'generation']);
      if (m.v !== 1) throw invalid();
      integer(m.generation, 1, 2147483647);
      if (
        [
          'key-registry.activate',
          'key-registry.revoke',
          'key-registry.remove',
        ].includes(r.action)
      ) {
        if (typeof r.targetId !== 'string' || r.targetId.length > 192)
          throw invalid();
        const tuple: unknown = JSON.parse(r.targetId);
        if (!Array.isArray(tuple) || tuple.length !== 3) throw invalid();
        const key = parseKeyReference({
          purpose: tuple[0],
          id: tuple[1],
          version: tuple[2],
        });
        if (JSON.stringify([key.purpose, key.id, key.version]) !== r.targetId)
          throw invalid();
      } else id(r.targetId);
      metadata = Object.freeze({ v: 1, generation: m.generation });
    } else if (
      typeof r.action === 'string' &&
      (accountActions as readonly unknown[]).includes(r.action)
    ) {
      // Identity-lifetime events are deployment-wide and success-only: the
      // generic denial paths of these journeys disclose nothing and stay
      // rate-counter territory. Only the operator-channel enrollment is
      // actor-less, attributed to the identity subsystem.
      if (r.projectId !== null || r.result !== 'success') throw invalid();
      id(r.targetId);
      if (r.action === 'account.enrolled') {
        if (r.actorId !== null || r.systemActor !== 'core.identity')
          throw invalid();
        record(r.metadata, ['v']);
        metadata = Object.freeze({ v: 1 });
      } else {
        if (r.actorId === null || r.systemActor !== null) throw invalid();
        if (r.action === 'account.linked') {
          const linked = record(r.metadata, ['v', 'kind']);
          if (linked.v !== 1 || linked.kind !== 'passkey') throw invalid();
          metadata = Object.freeze({ v: 1, kind: 'passkey' });
        } else {
          record(r.metadata, ['v']);
          metadata = Object.freeze({ v: 1 });
        }
      }
    } else if (
      typeof r.action === 'string' &&
      (administrationActions as readonly unknown[]).includes(r.action)
    ) {
      // Authorized administration mutations: an authenticated actor, success
      // only (denials belong to the authorization.checked trail), and project
      // scope exactly for the role events.
      if (
        r.actorId === null ||
        r.systemActor !== null ||
        r.result !== 'success'
      )
        throw invalid();
      id(r.targetId);
      if (r.action === 'role.granted' || r.action === 'role.revoked') {
        if (r.projectId === null) throw invalid();
        if (r.action === 'role.granted') {
          const granted = record(r.metadata, ['v', 'role']);
          if (
            granted.v !== 1 ||
            !(staffRoles as readonly unknown[]).includes(granted.role)
          )
            throw invalid();
          metadata = Object.freeze({ v: 1, role: granted.role as string });
        } else {
          record(r.metadata, ['v']);
          metadata = Object.freeze({ v: 1 });
        }
      } else {
        if (r.projectId !== null) throw invalid();
        record(r.metadata, ['v']);
        metadata = Object.freeze({ v: 1 });
      }
    } else if (
      typeof r.action === 'string' &&
      (pluginActions as readonly unknown[]).includes(r.action)
    ) {
      // Deployment-level plugin administration by an authenticated actor,
      // success only (denials belong to the authorization.checked trail) and
      // never any setting value: configure records counts, not contents.
      // Plugin ids and versions are mirrored from PLUGIN-SPEC §9's patterns
      // so the security package stays free of a plugin-api dependency.
      if (
        r.projectId !== null ||
        r.actorId === null ||
        r.systemActor !== null ||
        r.result !== 'success'
      )
        throw invalid();
      if (
        typeof r.targetId !== 'string' ||
        !/^@[a-z0-9][a-z0-9-]{0,62}\/[a-z0-9][a-z0-9-]{0,62}$/.test(r.targetId)
      )
        throw invalid();
      if (r.action === 'plugin.registered' || r.action === 'plugin.upgraded') {
        const m = record(r.metadata, ['v', 'version']);
        if (
          m.v !== 1 ||
          typeof m.version !== 'string' ||
          !/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+)?$/.test(m.version) ||
          m.version.length > 64
        )
          throw invalid();
        metadata = Object.freeze({ v: 1, version: m.version });
      } else if (r.action === 'plugin.uninstalled') {
        const m = record(r.metadata, ['v', 'version', 'policy']);
        if (
          m.v !== 1 ||
          typeof m.version !== 'string' ||
          !/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+)?$/.test(m.version) ||
          (m.policy !== 'retain' && m.policy !== 'delete')
        )
          throw invalid();
        metadata = Object.freeze({
          v: 1,
          version: m.version,
          policy: m.policy,
        });
      } else if (r.action === 'plugin.configured') {
        const m = record(r.metadata, ['v', 'publicCount', 'secretCount']);
        if (m.v !== 1) throw invalid();
        integer(m.publicCount, 0, 128);
        integer(m.secretCount, 0, 128);
        metadata = Object.freeze({
          v: 1,
          publicCount: m.publicCount,
          secretCount: m.secretCount,
        });
      } else {
        record(r.metadata, ['v']);
        metadata = Object.freeze({ v: 1 });
      }
    } else throw invalid();
    return Object.freeze({
      id: r.id,
      projectId: r.projectId as string | null,
      actorId: r.actorId as string | null,
      systemActor: r.systemActor as AuditEvent['systemActor'],
      action: r.action as AuditAction,
      targetId: r.targetId as string,
      result: r.result,
      requestId: r.requestId,
      createdAt: r.createdAt,
      metadata,
    });
  } catch {
    throw invalid();
  }
}

export interface AuditBoundary {
  readonly createdAt: number;
  readonly id: string;
}
export interface AuditListOptions {
  readonly projectId: string;
  readonly limit: number;
  readonly before: AuditBoundary | null;
}
/** Internal storage port. It grants no permission and exposes no edit/delete API. */
export interface AuditRepository {
  append(event: AuditEvent, signal: AbortSignal): Promise<void>;
  /** Returns at most limit + 1 rows for lookahead, newest first. */
  list(
    options: AuditListOptions,
    signal: AbortSignal,
  ): Promise<readonly AuditEvent[]>;
}
export function auditListOptions(input: AuditListOptions): AuditListOptions {
  const r = record(input, ['projectId', 'limit', 'before']);
  id(r.projectId);
  integer(r.limit, 1, 100);
  let before: AuditBoundary | null = null;
  if (r.before !== null) {
    const b = record(r.before, ['createdAt', 'id']);
    id(b.id);
    integer(b.createdAt, 0, 8640000000000000);
    before = Object.freeze({ createdAt: b.createdAt, id: b.id });
  }
  return Object.freeze({ projectId: r.projectId, limit: r.limit, before });
}
export interface AuditPage {
  readonly items: readonly AuditEvent[];
  readonly nextCursor: string | null;
}
export interface AuditReadRequest {
  readonly actorId: string;
  readonly projectId: string;
  readonly limit?: number;
  readonly after?: string;
}
function readOptions(input: AuditReadRequest): {
  actorId: string;
  query: AuditListOptions;
} {
  if (
    !input ||
    Object.keys(input).some(
      (k) => !['actorId', 'projectId', 'limit', 'after'].includes(k),
    )
  )
    throw invalid();
  id(input.actorId);
  id(input.projectId);
  let before: AuditBoundary | null = null;
  if (input.after !== undefined) {
    try {
      const c = record(
        JSON.parse(
          new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
            decodeBase64Url(input.after, 1, 768),
          ),
        ),
        ['v', 'resource', 'projectId', 'sort', 'before'],
      );
      if (
        c.v !== 1 ||
        c.resource !== 'audit' ||
        c.projectId !== input.projectId ||
        c.sort !== 'created-desc-id-desc'
      )
        throw invalid();
      before = c.before as AuditBoundary;
      if (before === null) throw invalid();
    } catch {
      throw invalid();
    }
  }
  return {
    actorId: input.actorId,
    query: auditListOptions({
      projectId: input.projectId,
      limit: input.limit === undefined ? 40 : input.limit,
      before,
    }),
  };
}
function page(rows: readonly AuditEvent[], query: AuditListOptions): AuditPage {
  if (!Array.isArray(rows) || rows.length > query.limit + 1)
    throw new AuditFailure();
  let safe: AuditEvent[];
  try {
    safe = rows.map(auditEvent);
  } catch {
    throw new AuditFailure();
  }
  let previous = query.before;
  for (const row of safe) {
    if (
      row.projectId !== query.projectId ||
      (previous &&
        (row.createdAt > previous.createdAt ||
          (row.createdAt === previous.createdAt && row.id >= previous.id)))
    )
      throw new AuditFailure();
    previous = row;
  }
  const items = Object.freeze(safe.slice(0, query.limit));
  const last = items.at(-1);
  const nextCursor =
    safe.length > query.limit && last
      ? encodeBase64Url(
          new TextEncoder().encode(
            JSON.stringify({
              v: 1,
              resource: 'audit',
              projectId: query.projectId,
              sort: 'created-desc-id-desc',
              before: { createdAt: last.createdAt, id: last.id },
            }),
          ),
        )
      : null;
  return Object.freeze({ items, nextCursor });
}
function snapshotRequest(input: PermissionRequest): PermissionRequest {
  const r = record(input, ['actorId', 'permission', 'target']);
  if (r.actorId !== null) id(r.actorId);
  if (!isPermission(r.permission)) throw invalid();
  const t = record(r.target, ['projectId', 'type', 'id']);
  id(t.projectId);
  id(t.id);
  if (!(resourceTypes as readonly unknown[]).includes(t.type)) throw invalid();
  return Object.freeze({
    actorId: r.actorId as string | null,
    permission: r.permission,
    target: Object.freeze({
      projectId: t.projectId,
      type: t.type as ResourceType,
      id: t.id,
    }),
  });
}

/** Canonical startup event for a minimum-tier enablement attempt or change. */
export function deploymentEnablementAuditEvent(
  outcome: 'refused' | 'enabled',
  nowMs: number,
): AuditEvent {
  return auditEvent({
    id: crypto.randomUUID(),
    projectId: null,
    actorId: null,
    systemActor: 'core.deployment',
    action: 'deployment.enablement',
    targetId: 'cloudflare-free-minimum',
    result: outcome === 'enabled' ? 'success' : 'failure',
    requestId: crypto.randomUUID(),
    createdAt: nowMs,
    metadata: { v: 1, acknowledgement: 'free-minimum-v1', outcome },
  });
}

export function createAuditService(options: {
  repository: AuditRepository;
  authorization: AuthorizationResolver;
  policy: AuthorizationPolicy;
  now?: () => number;
  timeoutMs?: number;
  maxConcurrent?: number;
}) {
  const timeoutMs = options.timeoutMs ?? 2000;
  const maxConcurrent = options.maxConcurrent ?? 4;
  integer(timeoutMs, 10, 5000);
  integer(maxConcurrent, 1, 16);
  const { repository, authorization } = options;
  const policy = Object.freeze({ ...options.policy });
  const now = options.now ?? Date.now;
  let active = 0;
  async function bounded<T>(
    parent: AbortSignal,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (parent.aborted || active >= maxConcurrent) throw new AuditFailure();
    active++;
    const controller = new AbortController();
    const signal = AbortSignal.any([parent, controller.signal]);
    let onAbort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(new AuditFailure());
      signal.addEventListener('abort', onAbort, { once: true });
    });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Keep the permit until real work settles, even if the caller has timed out.
    const work = Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return run(signal);
      })
      .finally(() => {
        active--;
      });
    try {
      return await Promise.race([work, aborted]);
    } catch (error) {
      throw error instanceof AuditFailure ? error : new AuditFailure();
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      controller.abort();
    }
  }
  return {
    /** Audit a permission check, never claim the requested mutation happened.
     * Required mutation audit still belongs in the mutation's transaction.
     */
    async check(
      input: PermissionRequest,
      requestId: string,
      signal: AbortSignal,
    ): Promise<AuthorizationDecision> {
      const request = snapshotRequest(input);
      id(requestId);
      try {
        return await bounded(signal, async (inner) => {
          const decision = await authorize(request, authorization, policy, {
            signal: inner,
            now,
          });
          inner.throwIfAborted();
          await repository.append(
            auditEvent({
              id: crypto.randomUUID(),
              projectId: request.target.projectId,
              actorId: request.actorId,
              systemActor:
                request.actorId === null ? 'core.authorization' : null,
              action: 'authorization.checked',
              targetId: request.target.id,
              result: decision.allowed ? 'success' : 'failure',
              requestId,
              createdAt: now(),
              metadata: {
                v: 1,
                permission: request.permission,
                resourceType: request.target.type,
                decision: decision.allowed ? 'allowed' : decision.reason,
              },
            }),
            inner,
          );
          inner.throwIfAborted();
          // A slow audit write cannot revive expired/revoked permission.
          return decision.allowed
            ? authorize(request, authorization, policy, { signal: inner, now })
            : decision;
        });
      } catch {
        return { allowed: false, reason: 'unavailable' };
      }
    },
    async read(
      input: AuditReadRequest,
      signal: AbortSignal,
    ): Promise<AuditPage> {
      const { actorId, query } = readOptions(input);
      return bounded(signal, async (inner) => {
        const request: PermissionRequest = {
          actorId,
          permission: 'audit:read',
          target: {
            projectId: query.projectId,
            type: 'audit',
            id: query.projectId,
          },
        };
        const reauthorize = async () => {
          const decision = await authorize(request, authorization, policy, {
            signal: inner,
            now,
          });
          if (!decision.allowed)
            throw new AuditFailure(
              decision.reason === 'unavailable'
                ? 'AUDIT_UNAVAILABLE'
                : 'AUDIT_FORBIDDEN',
            );
        };
        await reauthorize();
        const rows = await repository.list(query, inner);
        inner.throwIfAborted();
        await reauthorize();
        inner.throwIfAborted();
        return page(rows, query);
      });
    },
  };
}

/** A review proposal, not authority to delete. The ordinary repository has no deletion method. */
export function auditRetentionProposal(input: {
  now: number;
  retentionSeconds: number;
  legalHold: boolean;
  maxBatch: number;
}): Readonly<{
  cutoffExclusive: number;
  maxBatch: number;
  requiresIndependentReview: true;
}> {
  const r = record(input, ['now', 'retentionSeconds', 'legalHold', 'maxBatch']);
  integer(r.now, 0, 8640000000000000);
  integer(r.retentionSeconds, 86400, 315360000);
  integer(r.maxBatch, 1, 100);
  if (typeof r.legalHold !== 'boolean' || r.legalHold)
    throw new AuditFailure('AUDIT_FORBIDDEN');
  return Object.freeze({
    cutoffExclusive: Math.max(0, r.now - r.retentionSeconds * 1000),
    maxBatch: r.maxBatch,
    requiresIndependentReview: true,
  });
}
