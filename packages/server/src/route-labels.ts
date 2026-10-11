import type { RouteLabel } from '@hyperbug/observability';
export const routeLabelRules: readonly {
  readonly label: RouteLabel;
  /** null matches every method. */
  readonly methods: readonly string[] | null;
  readonly path?: string;
  readonly prefix?: string;
  readonly infix?: string;
}[] = [
  {
    label: 'account.register',
    methods: ['GET', 'POST'],
    path: '/api/v1/accounts/register',
  },
  { label: 'account.login', methods: ['GET', 'POST'], path: '/auth/login' },
  { label: 'account.session', methods: ['GET'], path: '/auth/session' },
  { label: 'account.logout', methods: ['POST'], path: '/auth/logout' },
  {
    label: 'account.bootstrap',
    methods: ['POST'],
    path: '/auth/bootstrap/enroll',
  },
  { label: 'account.instance', methods: ['GET'], path: '/api/v1/instance' },
  { label: 'account.account', methods: ['GET'], path: '/api/v1/account' },
  {
    label: 'account.sessions',
    methods: ['GET', 'DELETE'],
    path: '/api/v1/account/sessions',
  },
  {
    label: 'account.sessions',
    methods: ['DELETE'],
    prefix: '/api/v1/account/sessions/',
  },
  {
    label: 'admin.principal',
    methods: ['POST'],
    prefix: '/api/v1/admin/principals/',
  },
  {
    label: 'project.members',
    methods: ['PUT', 'DELETE'],
    prefix: '/api/v1/projects/',
    infix: '/members/',
  },
  {
    label: 'project.upload',
    methods: ['GET', 'POST', 'PUT'],
    prefix: '/api/v1/projects/',
    infix: '/uploads',
  },
  {
    label: 'project.content',
    methods: ['GET', 'POST', 'PUT'],
    prefix: '/api/v1/projects/',
    infix: '/forms',
  },
  {
    label: 'project.content',
    methods: ['GET', 'POST', 'PUT'],
    prefix: '/api/v1/projects/',
    infix: '/templates',
  },
  {
    label: 'project.taxonomy',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    prefix: '/api/v1/projects/',
    infix: '/labels',
  },
  {
    label: 'project.taxonomy',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    prefix: '/api/v1/projects/',
    infix: '/issue-types',
  },
  {
    label: 'project.taxonomy',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    prefix: '/api/v1/projects/',
    infix: '/milestones',
  },
  {
    label: 'issue.discussion',
    methods: null,
    prefix: '/api/v1/projects/',
    infix: '/comments',
  },
  {
    label: 'issue.discussion',
    methods: null,
    prefix: '/api/v1/projects/',
    infix: '/reactions',
  },
  {
    label: 'issue.discussion',
    methods: ['GET'],
    prefix: '/api/v1/projects/',
    infix: '/timeline',
  },
  {
    label: 'issue.triage',
    methods: ['POST', 'PUT'],
    prefix: '/api/v1/projects/',
    infix: '/issues/',
  },
  {
    label: 'issue.write',
    methods: ['POST', 'PATCH'],
    prefix: '/api/v1/projects/',
    infix: '/issues',
  },
  {
    label: 'issue.read',
    methods: ['GET'],
    prefix: '/api/v1/projects/',
    infix: '/issues',
  },
  {
    label: 'project.manage',
    methods: ['POST'],
    path: '/api/v1/projects',
  },
  {
    label: 'project.manage',
    methods: ['POST', 'PATCH'],
    prefix: '/api/v1/projects/',
  },
  { label: 'project.read', methods: ['GET'], prefix: '/api/v1/projects/' },
  {
    label: 'account.recovery-codes',
    methods: ['POST'],
    path: '/auth/recovery-codes',
  },
  { label: 'account.recover', methods: ['POST'], path: '/auth/recover' },
  {
    label: 'account.passkey',
    methods: ['POST'],
    prefix: '/auth/passkey/',
  },
  { label: 'account.authorize', methods: null, path: '/auth/authorize' },
  { label: 'account.authorize', methods: null, prefix: '/auth/authorize/' },
  { label: 'account.token', methods: ['POST'], path: '/auth/token' },
  {
    label: 'account.token',
    methods: ['POST'],
    path: '/auth/token/revoke',
  },
  {
    label: 'admin.plugins',
    methods: null,
    prefix: '/api/v1/admin/plugins',
  },
  { label: 'health.live', methods: ['GET'], path: '/health/live' },
  { label: 'health.ready', methods: ['GET'], path: '/health/ready' },
  { label: 'proof', methods: null, prefix: '/_proof' },
];

export function routeLabelFor(path: string, method: string): RouteLabel {
  for (const rule of routeLabelRules) {
    if (rule.methods !== null && !rule.methods.includes(method)) continue;
    if (rule.path !== undefined && path !== rule.path) continue;
    if (rule.prefix !== undefined && !path.startsWith(rule.prefix)) continue;
    if (rule.infix !== undefined && !path.includes(rule.infix)) continue;
    return rule.label;
  }
  return 'unmatched';
}
