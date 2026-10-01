/** Facts must be loaded from current server state, never from request claims. */
export type ResourceType =
  | 'project'
  | 'issue'
  | 'comment'
  | 'audit'
  | 'plugin'
  | 'secret'
  | 'key'
  | 'export';
export type StaffRole = 'triage' | 'maintainer' | 'administrator';
type Rule = {
  types: readonly ResourceType[];
  write?: boolean;
  publicRead?: boolean;
  role?: StaffRole;
  sensitive?: boolean;
};
const rules = {
  'project:read': { types: ['project'], publicRead: true },
  'issue:read': { types: ['issue'], publicRead: true },
  'comment:read': { types: ['comment'], publicRead: true },
  'issue:create': { types: ['project'], write: true },
  'issue:update': { types: ['issue'], write: true },
  'comment:create': { types: ['issue'], write: true },
  'comment:update': { types: ['comment'], write: true },
  'reaction:write': { types: ['issue', 'comment'], write: true },
  'issue:triage': { types: ['issue'], write: true, role: 'triage' },
  'issue:assign': { types: ['issue'], write: true, role: 'triage' },
  'issue:close': { types: ['issue'], write: true, role: 'triage' },
  'issue:moderate': {
    types: ['issue', 'comment'],
    write: true,
    role: 'maintainer',
  },
  'taxonomy:manage': {
    types: ['project'],
    write: true,
    role: 'maintainer',
  },
  'project:configure': {
    types: ['project'],
    write: true,
    role: 'administrator',
    sensitive: true,
  },
  'project:delete': {
    types: ['project'],
    write: true,
    role: 'administrator',
    sensitive: true,
  },
  'role:manage': {
    types: ['project'],
    write: true,
    role: 'administrator',
    sensitive: true,
  },
  'audit:read': { types: ['audit'], role: 'administrator' },
  'plugin:install': {
    types: ['project'],
    write: true,
    role: 'administrator',
    sensitive: true,
  },
  'plugin:configure': {
    types: ['plugin'],
    write: true,
    role: 'administrator',
    sensitive: true,
  },
  'sso:configure': {
    types: ['project'],
    write: true,
    role: 'administrator',
    sensitive: true,
  },
  'secret:rotate': {
    types: ['secret'],
    write: true,
    role: 'administrator',
    sensitive: true,
  },
  'key:manage': {
    types: ['key'],
    write: true,
    role: 'administrator',
    sensitive: true,
  },
  'data:export': {
    types: ['export'],
    write: true,
    role: 'administrator',
    sensitive: true,
  },
} as const satisfies Record<string, Rule>;

export type Permission = keyof typeof rules;
export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && Object.hasOwn(rules, value);
}
export interface ResourceRef {
  readonly projectId: string;
  readonly type: ResourceType;
  readonly id: string;
}
export interface PermissionRequest {
  readonly actorId: string | null;
  readonly permission: Permission;
  readonly target: ResourceRef;
}
export interface AuthorizationFacts {
  /** Bind every answer to the exact actor, action and resource that was checked. */
  readonly binding: PermissionRequest;
  readonly principal: null | {
    readonly id: string;
    readonly kind: 'user' | 'staff';
    readonly status: 'active' | 'suspended' | 'deleted';
    readonly credentialActive: boolean;
    readonly expiresAtMs: number;
    readonly authenticatedAtMs: number;
    /** Verified assurance, not a provider's unvalidated amr/acr claim. */
    readonly assurance: 1 | 2 | 3;
  };
  readonly project: {
    readonly id: string;
    readonly visibility: 'public' | 'private';
    readonly state: 'active' | 'archived' | 'deleted';
  };
  readonly membership: null | {
    readonly principalId: string;
    readonly projectId: string;
    readonly active: boolean;
    readonly role: StaffRole;
  };
  readonly resource: {
    readonly ref: ResourceRef;
    readonly deleted: boolean;
    readonly publicReadable: boolean;
    /** Feature policy checked ownership, locks and visibility for this operation. */
    readonly permissionGranted: boolean;
  };
}
export interface AuthorizationPolicy {
  readonly recentAuthMaxAgeMs: number;
  readonly timeoutMs: number;
}
export type AuthorizationDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason:
        | 'forbidden'
        | 'reauthentication_required'
        | 'unavailable';
    };
export interface AuthorizationResolver {
  resolve(
    request: PermissionRequest,
    signal: AbortSignal,
  ): Promise<AuthorizationFacts>;
}

const forbidden: AuthorizationDecision = Object.freeze({
  allowed: false,
  reason: 'forbidden',
});
const unavailable: AuthorizationDecision = Object.freeze({
  allowed: false,
  reason: 'unavailable',
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const roles: readonly StaffRole[] = ['triage', 'maintainer', 'administrator'];
function sameResource(a: ResourceRef, b: ResourceRef): boolean {
  return a.id === b.id && a.projectId === b.projectId && a.type === b.type;
}
function validPolicy(policy: AuthorizationPolicy): boolean {
  return (
    Number.isSafeInteger(policy.recentAuthMaxAgeMs) &&
    policy.recentAuthMaxAgeMs >= 1000 &&
    policy.recentAuthMaxAgeMs <= 900000 &&
    Number.isSafeInteger(policy.timeoutMs) &&
    policy.timeoutMs >= 10 &&
    policy.timeoutMs <= 5000
  );
}

/** This evaluator grants no role, loads no identity, and caches no decision. */
function evaluateFacts(
  request: PermissionRequest,
  facts: AuthorizationFacts,
  policy: AuthorizationPolicy,
  nowMs: number,
): AuthorizationDecision {
  if (!validPolicy(policy) || !Number.isSafeInteger(nowMs) || nowMs < 0)
    return unavailable;
  if (!Object.hasOwn(rules, request.permission)) return forbidden;
  const rule: Rule = rules[request.permission];
  if (
    !uuid.test(request.target.id) ||
    !uuid.test(request.target.projectId) ||
    !rule.types.includes(request.target.type)
  )
    return forbidden;
  if (
    request.target.type === 'project' &&
    request.target.id !== request.target.projectId
  )
    return forbidden;
  if (
    facts.binding.actorId !== request.actorId ||
    facts.binding.permission !== request.permission ||
    !sameResource(facts.binding.target, request.target)
  )
    return forbidden;
  if (
    !sameResource(facts.resource.ref, request.target) ||
    facts.project.id !== request.target.projectId ||
    facts.resource.deleted !== false
  )
    return forbidden;
  if (
    !['active', 'archived'].includes(facts.project.state) ||
    !['public', 'private'].includes(facts.project.visibility)
  )
    return forbidden;
  if (rule.write && facts.project.state !== 'active') return forbidden;
  const publicRead =
    rule.publicRead === true &&
    facts.project.visibility === 'public' &&
    facts.resource.publicReadable === true;
  const principal = facts.principal;
  if (request.actorId === null)
    return publicRead && principal === null ? { allowed: true } : forbidden;
  if (
    !uuid.test(request.actorId) ||
    !principal ||
    principal.id !== request.actorId ||
    principal.status !== 'active' ||
    principal.credentialActive !== true ||
    !['user', 'staff'].includes(principal.kind)
  )
    return forbidden;
  if (
    !Number.isSafeInteger(principal.expiresAtMs) ||
    principal.expiresAtMs <= nowMs ||
    !Number.isSafeInteger(principal.authenticatedAtMs) ||
    principal.authenticatedAtMs < 0 ||
    principal.authenticatedAtMs > nowMs ||
    ![1, 2, 3].includes(principal.assurance)
  )
    return forbidden;
  if (publicRead) return { allowed: true };
  const membership = facts.membership;
  const staffMember =
    principal.kind === 'staff' &&
    membership?.active === true &&
    membership.principalId === principal.id &&
    membership.projectId === request.target.projectId &&
    roles.includes(membership.role);
  if (facts.project.visibility === 'private' && !staffMember) return forbidden;
  if (principal.kind === 'staff' && !staffMember) return forbidden;
  if (facts.resource.permissionGranted !== true) return forbidden;
  if (
    rule.role &&
    (!staffMember ||
      !membership ||
      roles.indexOf(membership.role) < roles.indexOf(rule.role))
  )
    return forbidden;
  if (
    rule.sensitive &&
    (principal.assurance < 2 ||
      nowMs - principal.authenticatedAtMs > policy.recentAuthMaxAgeMs)
  )
    return { allowed: false, reason: 'reauthentication_required' };
  return { allowed: true };
}

export function evaluatePermission(
  request: PermissionRequest,
  facts: AuthorizationFacts,
  policy: AuthorizationPolicy,
  nowMs: number,
): AuthorizationDecision {
  try {
    return evaluateFacts(request, facts, policy, nowMs);
  } catch {
    return unavailable;
  }
}

/** Resolver errors, malformed facts, caller cancellation and timeouts deny access. */
export async function authorize(
  request: PermissionRequest,
  resolver: AuthorizationResolver,
  policy: AuthorizationPolicy,
  options: { signal?: AbortSignal; now?: () => number } = {},
): Promise<AuthorizationDecision> {
  let policySnapshot: AuthorizationPolicy;
  let callerSignal: AbortSignal | undefined;
  let now: () => number;
  try {
    policySnapshot = Object.freeze({
      recentAuthMaxAgeMs: policy.recentAuthMaxAgeMs,
      timeoutMs: policy.timeoutMs,
    });
    callerSignal = options.signal;
    now = options.now ?? Date.now;
    if (!validPolicy(policySnapshot) || callerSignal?.aborted)
      return unavailable;
  } catch {
    return unavailable;
  }
  const controller = new AbortController();
  let signal: AbortSignal;
  let snapshot: PermissionRequest;
  try {
    signal = callerSignal
      ? AbortSignal.any([controller.signal, callerSignal])
      : controller.signal;
    snapshot = Object.freeze({
      ...request,
      target: Object.freeze({ ...request.target }),
    });
  } catch {
    return unavailable;
  }
  let onAbort: () => void = () => {};
  const aborted = new Promise<AuthorizationDecision>((resolve) => {
    onAbort = () => resolve(unavailable);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  const timer = setTimeout(() => controller.abort(), policySnapshot.timeoutMs);
  try {
    return await Promise.race([
      aborted,
      Promise.resolve().then(async () => {
        if (signal.aborted) return unavailable;
        const facts = await resolver.resolve(snapshot, signal);
        if (signal.aborted) return unavailable;
        return evaluatePermission(snapshot, facts, policySnapshot, now());
      }),
    ]);
  } catch {
    return unavailable;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    controller.abort();
  }
}
