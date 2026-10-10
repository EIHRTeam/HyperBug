import { sql, type SQLWrapper } from 'drizzle-orm';
import {
  sqliteTable as table,
  text,
  integer,
  unique,
  uniqueIndex,
  index,
  check,
  foreignKey,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
const id = (name: string) => text(name);
const instant = (name: string) => integer(name);
const json = (name: string) => text(name);
const validId = (name: string, column: SQLWrapper) =>
  check(
    name,
    sql`length(${column}) = 36 AND ${column} = lower(${column}) AND length(replace(${column}, '-', '')) = 32 AND replace(${column}, '-', '') NOT GLOB '*[^0-9a-f]*' AND substr(${column},9,1) = '-' AND substr(${column},14,1) = '-' AND substr(${column},19,1) = '-' AND substr(${column},24,1) = '-' AND substr(${column},15,1) = '4' AND substr(${column},20,1) IN ('8','9','a','b')`,
  );
const validTime = (name: string, column: SQLWrapper) =>
  check(
    name,
    sql`${column} IS NULL OR (typeof(${column}) = 'integer' AND ${column} BETWEEN 0 AND 8640000000000000)`,
  );
const validJson = (name: string, column: SQLWrapper) =>
  check(name, sql`json_valid(${column}) AND length(${column}) <= 65536`);

export const principals = table(
  'principals',
  {
    id: id('id').primaryKey(),
    kind: text('kind').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: instant('created_at').notNull(),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    check('principal_kind', sql`${t.kind} IN ('user','staff')`),
    check(
      'principal_status',
      sql`${t.status} IN ('active','suspended','deleted')`,
    ),
    check(
      'principal_revision',
      sql`${t.revision} > 0 AND ${t.revision} <= 2147483647`,
    ),
    unique('principal_identity_kind').on(t.id, t.kind),
    check(
      'principal_revision_integer',
      sql`cast(${t.revision} as bigint) = ${t.revision}`,
    ),
    validId('principal_id', t.id),
    validTime('principal_created', t.createdAt),
  ],
);

export const projects = table(
  'projects',
  {
    id: id('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    visibility: text('visibility').notNull().default('public'),
    status: text('status').notNull().default('active'),
    nextIssueNumber: integer('next_issue_number').notNull().default(1),
    revision: integer('revision').notNull().default(1),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [
    check('project_visibility', sql`${t.visibility} IN ('public','private')`),
    check('project_status', sql`${t.status} IN ('active','archived')`),
    check(
      'project_number_bound',
      sql`${t.nextIssueNumber} >= 1 AND ${t.nextIssueNumber} <= 2147483647`,
    ),
    check(
      'project_revision',
      sql`${t.revision} > 0 AND ${t.revision} <= 2147483647`,
    ),
    check(
      'project_slug',
      sql`length(${t.slug}) BETWEEN 1 AND 63 AND ${t.slug} = lower(${t.slug})`,
    ),
    check('project_time_order', sql`${t.updatedAt} >= ${t.createdAt}`),
    check(
      'project_counters_integer',
      sql`cast(${t.revision} as bigint) = ${t.revision} AND cast(${t.nextIssueNumber} as bigint) = ${t.nextIssueNumber}`,
    ),
    validId('project_id', t.id),
    validTime('project_created', t.createdAt),
    validTime('project_updated', t.updatedAt),
  ],
);

export const issues = table(
  'issues',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    bodyText: text('body_text'),
    bodyTextVersion: text('body_text_version'),
    state: text('state').notNull().default('open'),
    closeReason: text('close_reason'),
    typeId: id('type_id'),
    milestoneId: id('milestone_id'),
    moderation: text('moderation').notNull().default('visible'),
    deletedAt: instant('deleted_at'),
    authorId: id('author_id')
      .notNull()
      .references(() => principals.id),
    revision: integer('revision').notNull().default(1),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
    closedAt: instant('closed_at'),
    lastMutationId: id('last_mutation_id').notNull(),
  },
  (t) => [
    unique('issue_project_number').on(t.projectId, t.number),
    unique('issue_project_id').on(t.projectId, t.id),
    index('issue_project_created').on(t.projectId, t.createdAt, t.id),
    index('issue_project_state_created').on(
      t.projectId,
      t.state,
      t.createdAt,
      t.id,
    ),
    index('issue_author').on(t.authorId, t.id),
    index('issue_project_author_created').on(
      t.projectId,
      t.authorId,
      t.createdAt,
      t.id,
    ),
    index('issue_type_filter').on(t.projectId, t.typeId, t.createdAt, t.id),
    index('issue_milestone_filter').on(
      t.projectId,
      t.milestoneId,
      t.createdAt,
      t.id,
    ),
    foreignKey({
      columns: [t.projectId, t.typeId],
      foreignColumns: [issueTypes.projectId, issueTypes.id],
      name: 'issue_type_project_fk',
    }),
    foreignKey({
      columns: [t.projectId, t.milestoneId],
      foreignColumns: [milestones.projectId, milestones.id],
      name: 'issue_milestone_project_fk',
    }),
    check(
      'issue_moderation',
      sql`${t.moderation} IN ('visible','hidden','redacted')`,
    ),
    validTime('issue_deleted', t.deletedAt),
    check(
      'issue_deleted_order',
      sql`${t.deletedAt} IS NULL OR ${t.deletedAt} >= ${t.createdAt}`,
    ),
    check(
      'issue_number_bound',
      sql`${t.number} > 0 AND ${t.number} <= 2147483647`,
    ),
    check(
      'issue_revision',
      sql`${t.revision} > 0 AND ${t.revision} <= 2147483647`,
    ),
    check(
      'issue_title_bound',
      sql`length(${t.title}) BETWEEN 1 AND 200 AND ${t.title} = trim(${t.title})`,
    ),
    check('issue_body_bound', sql`length(${t.body}) <= 32768`),
    check(
      'issue_state_consistency',
      sql`(${t.state} = 'open' AND ${t.closeReason} IS NULL AND ${t.closedAt} IS NULL) OR (${t.state} = 'closed' AND ${t.closeReason} IS NOT NULL AND ${t.closeReason} IN ('completed','not_planned','duplicate','invalid','cannot_reproduce') AND ${t.closedAt} IS NOT NULL)`,
    ),
    check(
      'issue_time_order',
      sql`${t.updatedAt} >= ${t.createdAt} AND (${t.closedAt} IS NULL OR ${t.closedAt} >= ${t.createdAt})`,
    ),
    check(
      'issue_counters_integer',
      sql`cast(${t.revision} as bigint) = ${t.revision} AND cast(${t.number} as bigint) = ${t.number}`,
    ),
    validId('issue_id', t.id),
    validId('issue_mutation_id', t.lastMutationId),
    validTime('issue_created', t.createdAt),
    validTime('issue_updated', t.updatedAt),
    validTime('issue_closed', t.closedAt),
  ],
);

export const timelineEvents = table(
  'timeline_events',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id').notNull(),
    issueId: id('issue_id').notNull(),
    aggregateRevision: integer('aggregate_revision').notNull(),
    actorId: id('actor_id').references(() => principals.id),
    systemActor: text('system_actor'),
    action: text('action').notNull(),
    createdAt: instant('created_at').notNull(),
    metadata: json('metadata').notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.issueId],
      foreignColumns: [issues.projectId, issues.id],
      name: 'timeline_issue_project_fk',
    }),
    check(
      'timeline_actor',
      sql`(${t.actorId} IS NOT NULL AND ${t.systemActor} IS NULL) OR (${t.actorId} IS NULL AND ${t.systemActor} IS NOT NULL)`,
    ),
    unique('timeline_issue_revision').on(t.issueId, t.aggregateRevision),
    index('timeline_issue_order').on(t.projectId, t.issueId, t.createdAt, t.id),
    check('timeline_revision', sql`${t.aggregateRevision} > 0`),
    validJson('timeline_metadata', t.metadata),
    check(
      'timeline_revision_bound',
      sql`${t.aggregateRevision} <= 2147483647 AND cast(${t.aggregateRevision} as bigint) = ${t.aggregateRevision}`,
    ),
    validId('timeline_id', t.id),
    validTime('timeline_created', t.createdAt),
  ],
);

export const auditEvents = table(
  'audit_events',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id').references(() => projects.id),
    actorId: id('actor_id').references(() => principals.id),
    systemActor: text('system_actor'),
    action: text('action').notNull(),
    targetId: text('target_id').notNull(),
    result: text('result').notNull(),
    requestId: id('request_id').notNull(),
    createdAt: instant('created_at').notNull(),
    metadata: json('metadata').notNull(),
  },
  (t) => [
    check(
      'audit_actor',
      sql`(${t.actorId} IS NOT NULL AND ${t.systemActor} IS NULL) OR (${t.actorId} IS NULL AND ${t.systemActor} IS NOT NULL)`,
    ),
    check('audit_result', sql`${t.result} IN ('success','failure')`),
    index('audit_project_order').on(t.projectId, t.createdAt, t.id),
    validJson('audit_metadata', t.metadata),
    validId('audit_id', t.id),
    validId('audit_request_id', t.requestId),
    validTime('audit_created', t.createdAt),
  ],
);

export const outbox = table(
  'outbox',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    aggregateId: id('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    eventVersion: integer('event_version').notNull().default(1),
    payload: json('payload').notNull(),
    createdAt: instant('created_at').notNull(),
    availableAt: instant('available_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    deliveredAt: instant('delivered_at'),
  },
  (t) => [
    index('outbox_pending').on(t.deliveredAt, t.availableAt, t.id),
    index('outbox_pending_age').on(t.deliveredAt, t.createdAt, t.id),
    check('outbox_attempts', sql`${t.attempts} >= 0`),
    check('outbox_version', sql`${t.eventVersion} > 0`),
    validJson('outbox_payload', t.payload),
    check(
      'outbox_counters_integer',
      sql`${t.attempts} <= 2147483647 AND ${t.eventVersion} <= 2147483647 AND cast(${t.attempts} as bigint) = ${t.attempts} AND cast(${t.eventVersion} as bigint) = ${t.eventVersion}`,
    ),
    validId('outbox_id', t.id),
    validId('outbox_aggregate_id', t.aggregateId),
    validTime('outbox_created', t.createdAt),
    validTime('outbox_available', t.availableAt),
    validTime('outbox_delivered', t.deliveredAt),
  ],
);

export const mutationReceipts = table(
  'mutation_receipts',
  {
    id: id('id').primaryKey(),
    principalId: id('principal_id')
      .notNull()
      .references(() => principals.id),
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    operation: text('operation').notNull(),
    keyHash: text('key_hash').notNull(),
    payloadHash: text('payload_hash').notNull(),
    result: json('result').notNull(),
    createdAt: instant('created_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
  },
  (t) => [
    unique('receipt_scope').on(
      t.principalId,
      t.projectId,
      t.operation,
      t.keyHash,
    ),
    index('receipt_expiry').on(t.expiresAt, t.id),
    check(
      'receipt_hash_length',
      sql`length(${t.keyHash}) = 64 AND length(${t.payloadHash}) = 64`,
    ),
    check(
      'receipt_expiry_bound',
      sql`${t.expiresAt} > ${t.createdAt} AND ${t.expiresAt} <= ${t.createdAt} + 86400000`,
    ),
    validJson('receipt_result', t.result),
    validId('receipt_id', t.id),
    validTime('receipt_created', t.createdAt),
    validTime('receipt_expires', t.expiresAt),
  ],
);

// MVP persistence mappings. Owning feature modules supply authorization and state machines.
const revisionCheck = (name: string, value: SQLWrapper) =>
  check(
    name,
    sql`${value} BETWEEN 1 AND 2147483647 AND cast(${value} as integer) = ${value}`,
  );
const flagCheck = (name: string, value: SQLWrapper) =>
  check(name, sql`${value} IN (0,1)`);
const contentCheck = (name: string, value: SQLWrapper, max: number) =>
  check(name, sql`length(${value}) <= ${sql.raw(String(max))}`);

export const identities = table(
  'identities',
  {
    id: id('id').primaryKey(),
    principalId: id('principal_id')
      .notNull()
      .references(() => principals.id),
    provider: text('provider').notNull(),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    unique('identity_external_subject').on(t.provider, t.issuer, t.subject),
    index('identity_principal').on(t.principalId, t.id),
    validId('identity_id', t.id),
    validTime('identity_created', t.createdAt),
    check(
      'identity_provider_bound',
      sql`length(${t.provider}) BETWEEN 1 AND 100`,
    ),
    check('identity_issuer_bound', sql`length(${t.issuer}) BETWEEN 1 AND 1024`),
    check(
      'identity_subject_bound',
      sql`length(${t.subject}) BETWEEN 1 AND 1024`,
    ),
  ],
);

export const passwordCredentials = table(
  'password_credentials',
  {
    identityId: id('identity_id')
      .primaryKey()
      .references(() => identities.id),
    record: json('record').notNull(),
    revision: integer('revision').notNull().default(1),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [
    validJson('password_credential_record', t.record),
    revisionCheck('password_credential_revision', t.revision),
    validTime('password_credential_created', t.createdAt),
    validTime('password_credential_updated', t.updatedAt),
    check(
      'password_credential_time_order',
      sql`${t.updatedAt} >= ${t.createdAt}`,
    ),
  ],
);

export const projectRoles = table(
  'project_roles',
  {
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    principalId: id('principal_id').notNull(),
    principalKind: text('principal_kind').notNull().default('staff'),
    role: text('role').notNull(),
    grantedAt: instant('granted_at').notNull(),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.principalId] }),
    foreignKey({
      columns: [t.principalId, t.principalKind],
      foreignColumns: [principals.id, principals.kind],
      name: 'project_role_staff_fk',
    }),
    check('project_role_staff', sql`${t.principalKind} = 'staff'`),
    check(
      'project_role_name',
      sql`${t.role} IN ('triage','maintainer','administrator')`,
    ),
    index('project_role_principal').on(t.principalId, t.projectId),
    validTime('project_role_granted', t.grantedAt),
    revisionCheck('project_role_revision', t.revision),
  ],
);

export const issueTypes = table(
  'issue_types',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    description: text('description').notNull().default(''),
    icon: text('icon').notNull().default(''),
    color: text('color').notNull().default(''),
    position: integer('position').notNull().default(0),
    enabled: integer('enabled').notNull().default(1),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    unique('issue_type_project_id').on(t.projectId, t.id),
    unique('issue_type_project_name').on(t.projectId, t.nameKey),
    index('issue_type_order').on(t.projectId, t.position, t.id),
    validId('issue_type_id', t.id),
    revisionCheck('issue_type_revision', t.revision),
    check(
      'issue_type_name',
      sql`length(${t.name}) BETWEEN 1 AND 100 AND length(${t.nameKey}) BETWEEN 1 AND 200`,
    ),
    check(
      'issue_type_position',
      sql`${t.position} BETWEEN 0 AND 2147483647 AND cast(${t.position} as integer) = ${t.position}`,
    ),
    flagCheck('issue_type_enabled', t.enabled),
    contentCheck('issue_type_description', t.description, 4096),
    contentCheck('issue_type_icon', t.icon, 100),
    contentCheck('issue_type_color', t.color, 32),
  ],
);

export const labels = table(
  'labels',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    description: text('description').notNull().default(''),
    color: text('color').notNull().default(''),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    unique('label_project_id').on(t.projectId, t.id),
    unique('label_project_name').on(t.projectId, t.nameKey),
    validId('label_id', t.id),
    revisionCheck('label_revision', t.revision),
    check(
      'label_name',
      sql`length(${t.name}) BETWEEN 1 AND 100 AND length(${t.nameKey}) BETWEEN 1 AND 200`,
    ),
    contentCheck('label_description', t.description, 4096),
    contentCheck('label_color', t.color, 32),
  ],
);

export const milestones = table(
  'milestones',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    state: text('state').notNull().default('open'),
    dueDate: text('due_date'),
    revision: integer('revision').notNull().default(1),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [
    unique('milestone_project_id').on(t.projectId, t.id),
    index('milestone_project_state').on(t.projectId, t.state, t.id),
    validId('milestone_id', t.id),
    revisionCheck('milestone_revision', t.revision),
    check('milestone_title', sql`length(${t.title}) BETWEEN 1 AND 200`),
    contentCheck('milestone_description', t.description, 32768),
    check('milestone_state', sql`${t.state} IN ('open','closed')`),
    check(
      'milestone_date_shape',
      sql`${t.dueDate} IS NULL OR (length(${t.dueDate}) = 10 AND substr(${t.dueDate},5,1) = '-' AND substr(${t.dueDate},8,1) = '-')`,
    ),
    validTime('milestone_created', t.createdAt),
    validTime('milestone_updated', t.updatedAt),
    check('milestone_time_order', sql`${t.updatedAt} >= ${t.createdAt}`),
  ],
);

export const comments = table(
  'comments',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id').notNull(),
    issueId: id('issue_id').notNull(),
    authorId: id('author_id')
      .notNull()
      .references(() => principals.id),
    body: text('body').notNull(),
    bodyText: text('body_text'),
    bodyTextVersion: text('body_text_version'),
    lastMutationId: id('last_mutation_id'),
    revision: integer('revision').notNull().default(1),
    moderation: text('moderation').notNull().default('visible'),
    deletedAt: instant('deleted_at'),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [
    unique('comment_project_id').on(t.projectId, t.id),
    unique('comment_issue_id').on(t.projectId, t.issueId, t.id),
    foreignKey({
      columns: [t.projectId, t.issueId],
      foreignColumns: [issues.projectId, issues.id],
      name: 'comment_issue_project_fk',
    }),
    index('comment_issue_order').on(t.projectId, t.issueId, t.createdAt, t.id),
    index('comment_author').on(t.authorId, t.id),
    validId('comment_id', t.id),
    revisionCheck('comment_revision', t.revision),
    contentCheck('comment_body', t.body, 32768),
    check(
      'comment_moderation',
      sql`${t.moderation} IN ('visible','hidden','redacted')`,
    ),
    validTime('comment_created', t.createdAt),
    validTime('comment_updated', t.updatedAt),
    validTime('comment_deleted', t.deletedAt),
    check(
      'comment_time_order',
      sql`${t.updatedAt} >= ${t.createdAt} AND (${t.deletedAt} IS NULL OR ${t.deletedAt} >= ${t.createdAt})`,
    ),
  ],
);

export const commentHistory = table(
  'comment_history',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id').notNull(),
    commentId: id('comment_id').notNull(),
    revision: integer('revision').notNull(),
    editorId: id('editor_id')
      .notNull()
      .references(() => principals.id),
    body: text('body').notNull(),
    changedAt: instant('changed_at').notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.commentId],
      foreignColumns: [comments.projectId, comments.id],
      name: 'comment_history_project_fk',
    }),
    unique('comment_history_revision').on(t.commentId, t.revision),
    index('comment_history_order').on(t.projectId, t.commentId, t.revision),
    validId('comment_history_id', t.id),
    revisionCheck('comment_history_revision_bound', t.revision),
    validTime('comment_history_changed', t.changedAt),
    contentCheck('comment_history_body', t.body, 32768),
  ],
);

export const issueLabels = table(
  'issue_labels',
  {
    projectId: id('project_id').notNull(),
    issueId: id('issue_id').notNull(),
    labelId: id('label_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.issueId, t.labelId] }),
    foreignKey({
      columns: [t.projectId, t.issueId],
      foreignColumns: [issues.projectId, issues.id],
      name: 'issue_label_issue_fk',
    }),
    foreignKey({
      columns: [t.projectId, t.labelId],
      foreignColumns: [labels.projectId, labels.id],
      name: 'issue_label_label_fk',
    }),
    index('issue_label_filter').on(t.projectId, t.labelId, t.issueId),
  ],
);

export const issueAssignees = table(
  'issue_assignees',
  {
    projectId: id('project_id').notNull(),
    issueId: id('issue_id').notNull(),
    principalId: id('principal_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.issueId, t.principalId] }),
    foreignKey({
      columns: [t.projectId, t.issueId],
      foreignColumns: [issues.projectId, issues.id],
      name: 'issue_assignee_issue_fk',
    }),
    foreignKey({
      columns: [t.projectId, t.principalId],
      foreignColumns: [projectRoles.projectId, projectRoles.principalId],
      name: 'issue_assignee_member_fk',
    }),
    index('issue_assignee_filter').on(t.projectId, t.principalId, t.issueId),
  ],
);

export const reactions = table(
  'reactions',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id').notNull(),
    issueId: id('issue_id'),
    commentId: id('comment_id'),
    principalId: id('principal_id')
      .notNull()
      .references(() => principals.id),
    reaction: text('reaction').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.issueId],
      foreignColumns: [issues.projectId, issues.id],
      name: 'reaction_issue_project_fk',
    }),
    foreignKey({
      columns: [t.projectId, t.commentId],
      foreignColumns: [comments.projectId, comments.id],
      name: 'reaction_comment_project_fk',
    }),
    check(
      'reaction_one_target',
      sql`(${t.issueId} IS NOT NULL AND ${t.commentId} IS NULL) OR (${t.issueId} IS NULL AND ${t.commentId} IS NOT NULL)`,
    ),
    check(
      'reaction_allowlist',
      sql`${t.reaction} IN ('thumbs_up','thumbs_down','laugh','hooray','confused','heart','rocket','eyes')`,
    ),
    unique('reaction_issue_actor').on(t.issueId, t.principalId, t.reaction),
    unique('reaction_comment_actor').on(t.commentId, t.principalId, t.reaction),
    index('reaction_issue_group').on(t.projectId, t.issueId, t.reaction),
    index('reaction_comment_group').on(t.projectId, t.commentId, t.reaction),
    validId('reaction_id', t.id),
    validTime('reaction_created', t.createdAt),
  ],
);

export const issueForms = table(
  'issue_forms',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    enabled: integer('enabled').notNull().default(1),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    unique('issue_form_project_id').on(t.projectId, t.id),
    index('issue_form_project_enabled').on(t.projectId, t.enabled, t.id),
    validId('issue_form_id', t.id),
    revisionCheck('issue_form_revision', t.revision),
    flagCheck('issue_form_enabled', t.enabled),
    check('issue_form_name', sql`length(${t.name}) BETWEEN 1 AND 100`),
  ],
);

export const issueFormVersions = table(
  'issue_form_versions',
  {
    projectId: id('project_id').notNull(),
    formId: id('form_id').notNull(),
    version: integer('version').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    definition: json('definition').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.formId, t.version] }),
    foreignKey({
      columns: [t.projectId, t.formId],
      foreignColumns: [issueForms.projectId, issueForms.id],
      name: 'form_version_project_fk',
    }),
    revisionCheck('form_version_bound', t.version),
    revisionCheck('form_schema_version', t.schemaVersion),
    validJson('form_definition', t.definition),
    validTime('form_version_created', t.createdAt),
  ],
);

export const issueTemplates = table(
  'issue_templates',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    body: text('body').notNull(),
    enabled: integer('enabled').notNull().default(1),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    unique('issue_template_project_id').on(t.projectId, t.id),
    index('issue_template_project_enabled').on(t.projectId, t.enabled, t.id),
    validId('issue_template_id', t.id),
    revisionCheck('issue_template_revision', t.revision),
    flagCheck('issue_template_enabled', t.enabled),
    check('issue_template_name', sql`length(${t.name}) BETWEEN 1 AND 100`),
    contentCheck('issue_template_body', t.body, 32768),
  ],
);

export const issueTemplateVersions = table(
  'issue_template_versions',
  {
    projectId: id('project_id').notNull(),
    templateId: id('template_id').notNull(),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    body: text('body').notNull(),
    enabled: integer('enabled').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.templateId, t.version] }),
    foreignKey({
      columns: [t.projectId, t.templateId],
      foreignColumns: [issueTemplates.projectId, issueTemplates.id],
      name: 'template_version_project_fk',
    }),
    revisionCheck('template_version_bound', t.version),
    flagCheck('template_version_enabled', t.enabled),
    check('template_version_name', sql`length(${t.name}) BETWEEN 1 AND 100`),
    contentCheck('template_version_body', t.body, 32768),
    validTime('template_version_created', t.createdAt),
  ],
);

export const formSubmissions = table(
  'form_submissions',
  {
    projectId: id('project_id').notNull(),
    issueId: id('issue_id').notNull(),
    formId: id('form_id').notNull(),
    formVersion: integer('form_version').notNull(),
    values: json('values').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.issueId] }),
    foreignKey({
      columns: [t.projectId, t.issueId],
      foreignColumns: [issues.projectId, issues.id],
      name: 'form_submission_issue_fk',
    }),
    foreignKey({
      columns: [t.projectId, t.formId, t.formVersion],
      foreignColumns: [
        issueFormVersions.projectId,
        issueFormVersions.formId,
        issueFormVersions.version,
      ],
      name: 'form_submission_version_fk',
    }),
    index('form_submission_form').on(
      t.projectId,
      t.formId,
      t.formVersion,
      t.issueId,
    ),
    validJson('form_submission_values', t.values),
    validTime('form_submission_created', t.createdAt),
  ],
);

export const uploadIntents = table(
  'upload_intents',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id')
      .notNull()
      .references(() => projects.id),
    principalId: id('principal_id')
      .notNull()
      .references(() => principals.id),
    objectKey: text('object_key').notNull().unique(),
    mediaType: text('media_type').notNull(),
    maxBytes: instant('max_bytes').notNull(),
    state: text('state').notNull().default('pending'),
    revision: integer('revision').notNull().default(1),
    createdAt: instant('created_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
    verifiedObjectVersion: text('verified_object_version'),
    verifiedChecksum: text('verified_checksum'),
    actualBytes: instant('actual_bytes'),
  },
  (t) => [
    unique('upload_intent_project_id').on(t.projectId, t.id),
    index('upload_intent_expiry').on(t.state, t.expiresAt, t.id),
    index('upload_intent_principal').on(t.projectId, t.principalId, t.state),
    validId('upload_intent_id', t.id),
    revisionCheck('upload_intent_revision', t.revision),
    validTime('upload_intent_created', t.createdAt),
    validTime('upload_intent_expires', t.expiresAt),
    check('upload_intent_expiry_bound', sql`${t.expiresAt} > ${t.createdAt}`),
    check(
      'upload_intent_size',
      sql`${t.maxBytes} BETWEEN 1 AND 9007199254740991 AND cast(${t.maxBytes} as bigint) = ${t.maxBytes} AND (${t.actualBytes} IS NULL OR (${t.actualBytes} BETWEEN 0 AND ${t.maxBytes} AND cast(${t.actualBytes} as bigint) = ${t.actualBytes}))`,
    ),
    check(
      'upload_intent_state',
      sql`${t.state} IN ('pending','uploaded','finalized','expired','rejected')`,
    ),
    check(
      'upload_intent_finalized',
      sql`${t.state} != 'finalized' OR (${t.verifiedObjectVersion} IS NOT NULL AND ${t.verifiedChecksum} IS NOT NULL AND ${t.actualBytes} IS NOT NULL)`,
    ),
    check('upload_intent_key', sql`length(${t.objectKey}) BETWEEN 1 AND 1024`),
    check(
      'upload_intent_media_type',
      sql`length(${t.mediaType}) BETWEEN 1 AND 255`,
    ),
    contentCheck('upload_intent_version_bound', t.verifiedObjectVersion, 1024),
    contentCheck('upload_intent_checksum_bound', t.verifiedChecksum, 128),
  ],
);

// Additive lifecycle metadata: legacy foundational intents are not implicitly adopted.
export const uploadIntentDetails = table(
  'upload_intent_details',
  {
    intentId: id('intent_id').primaryKey(),
    projectId: id('project_id').notNull(),
    filename: text('filename').notNull(),
    finalKey: text('final_key').notNull().unique(),
    associationKind: text('association_kind').notNull(),
    draftId: id('draft_id'),
    issueId: id('issue_id'),
    commentId: id('comment_id'),
    leaseId: id('lease_id'),
    leaseExpiresAt: instant('lease_expires_at'),
    providerVersion: text('provider_version'),
    reservationState: text('reservation_state').notNull().default('reserved'),
    scanStatus: text('scan_status').notNull().default('unscanned'),
    policyState: text('policy_state').notNull().default('quarantined'),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.intentId],
      foreignColumns: [uploadIntents.projectId, uploadIntents.id],
      name: 'upload_details_intent_fk',
    }),
    foreignKey({
      columns: [t.projectId, t.issueId],
      foreignColumns: [issues.projectId, issues.id],
      name: 'upload_details_issue_fk',
    }),
    foreignKey({
      columns: [t.projectId, t.commentId],
      foreignColumns: [comments.projectId, comments.id],
      name: 'upload_details_comment_fk',
    }),
    check(
      'upload_details_association',
      sql`(${t.associationKind} = 'issue-draft' AND ${t.draftId} IS NOT NULL AND ${t.issueId} IS NULL AND ${t.commentId} IS NULL) OR (${t.associationKind} = 'comment-draft' AND ${t.draftId} IS NOT NULL AND ${t.issueId} IS NOT NULL AND ${t.commentId} IS NULL) OR (${t.associationKind} = 'issue' AND ${t.draftId} IS NULL AND ${t.issueId} IS NOT NULL AND ${t.commentId} IS NULL) OR (${t.associationKind} = 'comment' AND ${t.draftId} IS NULL AND ${t.issueId} IS NULL AND ${t.commentId} IS NOT NULL)`,
    ),
    check(
      'upload_details_lease',
      sql`(${t.leaseId} IS NULL AND ${t.leaseExpiresAt} IS NULL) OR (${t.leaseId} IS NOT NULL AND ${t.leaseExpiresAt} IS NOT NULL)`,
    ),
    check(
      'upload_details_reservation',
      sql`${t.reservationState} IN ('reserved','used','released')`,
    ),
    check(
      'upload_details_scan',
      sql`${t.scanStatus} IN ('unscanned','pending','clean','infected','failed')`,
    ),
    check(
      'upload_details_policy',
      sql`${t.policyState} IN ('quarantined','ready','rejected','deleted') AND (${t.policyState} != 'ready' OR ${t.scanStatus} IN ('unscanned','clean'))`,
    ),
    contentCheck('upload_details_filename', t.filename, 255),
    contentCheck('upload_details_final_key', t.finalKey, 1024),
    contentCheck('upload_details_provider_version', t.providerVersion, 1024),
    validId('upload_details_draft', t.draftId),
    validId('upload_details_lease_id', t.leaseId),
    validTime('upload_details_lease_time', t.leaseExpiresAt),
    index('upload_details_draft_lookup').on(t.projectId, t.draftId, t.intentId),
    index('upload_details_lease_lookup').on(t.leaseExpiresAt, t.intentId),
  ],
);

export const uploadMultipartSessions = table(
  'upload_multipart_sessions',
  {
    intentId: id('intent_id').primaryKey(),
    projectId: id('project_id').notNull(),
    partBytes: instant('part_bytes').notNull(),
    maxParts: integer('max_parts').notNull(),
    state: text('state').notNull().default('planned'),
    providerUploadId: text('provider_upload_id'),
    parts: json('parts').notNull().default('[]'),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.intentId],
      foreignColumns: [uploadIntents.projectId, uploadIntents.id],
      name: 'multipart_intent_project_fk',
    }),
    check(
      'multipart_plan',
      sql`${t.partBytes} BETWEEN 5242880 AND 5368709120 AND cast(${t.partBytes} as bigint) = ${t.partBytes} AND ${t.maxParts} BETWEEN 1 AND 10000`,
    ),
    check(
      'multipart_state',
      sql`${t.state} IN ('planned','creating','active','completing','completed','aborting','aborted')`,
    ),
    check(
      'multipart_provider',
      sql`(${t.providerUploadId} IS NULL AND ${t.state} IN ('planned','creating','aborting','aborted')) OR (${t.providerUploadId} IS NOT NULL AND length(${t.providerUploadId}) BETWEEN 1 AND 2048 AND ${t.state} NOT IN ('planned','creating'))`,
    ),
    validJson('multipart_catalog', t.parts),
    check(
      'multipart_catalog_array',
      sql`json_type(${t.parts}) = 'array' AND json_array_length(${t.parts}) <= ${t.maxParts}`,
    ),
    revisionCheck('multipart_revision', t.revision),
    index('multipart_state_lookup').on(t.state, t.intentId),
  ],
);

export const uploadScanResults = table(
  'upload_scan_results',
  {
    intentId: id('intent_id').primaryKey(),
    projectId: id('project_id').notNull(),
    attemptId: id('attempt_id').notNull(),
    sha256: text('sha256').notNull(),
    sizeBytes: instant('size_bytes').notNull(),
    policyVersion: text('policy_version').notNull(),
    status: text('status').notNull(),
    startedAt: instant('started_at').notNull(),
    completedAt: instant('completed_at'),
    evidence: json('evidence'),
    failureCode: text('failure_code'),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.intentId],
      foreignColumns: [uploadIntents.projectId, uploadIntents.id],
      name: 'scan_intent_project_fk',
    }),
    check(
      'scan_digest',
      sql`length(${t.sha256}) = 64 AND ${t.sha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      'scan_size',
      sql`${t.sizeBytes} BETWEEN 0 AND 9007199254740991 AND cast(${t.sizeBytes} as bigint) = ${t.sizeBytes}`,
    ),
    check('scan_policy', sql`length(${t.policyVersion}) BETWEEN 1 AND 64`),
    check(
      'scan_result',
      sql`(${t.status} = 'pending' AND ${t.completedAt} IS NULL AND ${t.evidence} IS NULL AND ${t.failureCode} IS NULL) OR (${t.status} IN ('clean','infected') AND ${t.completedAt} IS NOT NULL AND ${t.evidence} IS NOT NULL AND ${t.failureCode} IS NULL) OR (${t.status} = 'failed' AND ${t.completedAt} IS NOT NULL AND ${t.evidence} IS NULL AND ${t.failureCode} IS NOT NULL AND ${t.failureCode} IN ('unavailable','timeout','partial','identity','invalid-result'))`,
    ),
    validId('scan_attempt_id', t.attemptId),
    validTime('scan_started', t.startedAt),
    check(
      'scan_finished',
      sql`${t.completedAt} IS NULL OR (${t.completedAt} BETWEEN ${t.startedAt} AND 8640000000000000 AND cast(${t.completedAt} as bigint) = ${t.completedAt})`,
    ),
    check(
      'scan_evidence',
      sql`${t.evidence} IS NULL OR (json_valid(${t.evidence}) AND length(${t.evidence}) <= 65536)`,
    ),
    check(
      'scan_evidence_object',
      sql`${t.evidence} IS NULL OR (json_type(${t.evidence}) = 'object' AND coalesce((json_type(${t.evidence}, '$.engine') = 'text' AND length(json_extract(${t.evidence}, '$.engine')) BETWEEN 1 AND 128) AND (json_type(${t.evidence}, '$.engineVersion') = 'text' AND length(json_extract(${t.evidence}, '$.engineVersion')) BETWEEN 1 AND 128) AND (json_type(${t.evidence}, '$.signatureVersion') = 'text' AND length(json_extract(${t.evidence}, '$.signatureVersion')) BETWEEN 1 AND 128), 0))`,
    ),
    index('scan_pending_lookup').on(t.status, t.intentId),
  ],
);

// Explicit operator recovery ledger; no current lifecycle/association is fabricated.
export const uploadLegacyRecoveries = table(
  'upload_legacy_recoveries',
  {
    intentId: id('intent_id').primaryKey(),
    projectId: id('project_id').notNull(),
    principalId: id('principal_id')
      .notNull()
      .references(() => principals.id),
    decisionId: id('decision_id').notNull().unique(),
    decision: json('decision').notNull(),
    state: text('state').notNull(),
    revision: integer('revision').notNull().default(1),
    leaseId: id('lease_id'),
    leaseExpiresAt: instant('lease_expires_at'),
    createdAt: instant('created_at').notNull(),
    releasedAt: instant('released_at'),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.intentId],
      foreignColumns: [uploadIntents.projectId, uploadIntents.id],
      name: 'legacy_recovery_intent_fk',
    }),
    validId('legacy_recovery_decision', t.decisionId),
    validId('legacy_recovery_lease', t.leaseId),
    revisionCheck('legacy_recovery_revision', t.revision),
    validTime('legacy_recovery_created', t.createdAt),
    validTime('legacy_recovery_lease_time', t.leaseExpiresAt),
    check(
      'legacy_recovery_state',
      sql`(${t.state} = 'deleting' AND ${t.releasedAt} IS NULL AND ${t.leaseId} IS NOT NULL) OR (${t.state} = 'released' AND ${t.releasedAt} IS NOT NULL)`,
    ),
    check(
      'legacy_recovery_lease_pair',
      sql`(${t.leaseId} IS NULL AND ${t.leaseExpiresAt} IS NULL) OR (${t.leaseId} IS NOT NULL AND ${t.leaseExpiresAt} IS NOT NULL)`,
    ),
    check(
      'legacy_recovery_release_time',
      sql`${t.releasedAt} IS NULL OR (${t.releasedAt} BETWEEN ${t.createdAt} AND 8640000000000000 AND cast(${t.releasedAt} as bigint) = ${t.releasedAt})`,
    ),
    check(
      'legacy_recovery_payload',
      sql`json_valid(${t.decision}) AND json_type(${t.decision}) = 'object' AND length(cast(${t.decision} as blob)) BETWEEN 1 AND 8192`,
    ),
    index('legacy_recovery_project_lookup').on(t.projectId, t.intentId),
  ],
);

export const projectUploadUsage = table(
  'project_upload_usage',
  {
    projectId: id('project_id')
      .primaryKey()
      .references(() => projects.id),
    reservedBytes: instant('reserved_bytes').notNull().default(0),
    usedBytes: instant('used_bytes').notNull().default(0),
    reservedCount: integer('reserved_count').notNull().default(0),
  },
  (t) => [
    check(
      'project_upload_usage_bound',
      sql`${t.reservedBytes} >= 0 AND ${t.usedBytes} >= 0 AND ${t.reservedBytes} <= 9007199254740991 - ${t.usedBytes} AND cast(${t.reservedBytes} as bigint) = ${t.reservedBytes} AND cast(${t.usedBytes} as bigint) = ${t.usedBytes} AND ${t.reservedCount} BETWEEN 0 AND 10000 AND cast(${t.reservedCount} as bigint) = ${t.reservedCount}`,
    ),
  ],
);

export const principalUploadUsage = table(
  'principal_upload_usage',
  {
    principalId: id('principal_id')
      .primaryKey()
      .references(() => principals.id),
    reservedBytes: instant('reserved_bytes').notNull().default(0),
    usedBytes: instant('used_bytes').notNull().default(0),
    reservedCount: integer('reserved_count').notNull().default(0),
  },
  (t) => [
    check(
      'principal_upload_usage_bound',
      sql`${t.reservedBytes} >= 0 AND ${t.usedBytes} >= 0 AND ${t.reservedBytes} <= 9007199254740991 - ${t.usedBytes} AND cast(${t.reservedBytes} as bigint) = ${t.reservedBytes} AND cast(${t.usedBytes} as bigint) = ${t.usedBytes} AND ${t.reservedCount} BETWEEN 0 AND 10000 AND cast(${t.reservedCount} as bigint) = ${t.reservedCount}`,
    ),
  ],
);

export const attachments = table(
  'attachments',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id').notNull(),
    uploadIntentId: id('upload_intent_id').notNull().unique(),
    issueId: id('issue_id'),
    commentId: id('comment_id'),
    objectKey: text('object_key').notNull(),
    objectVersion: text('object_version').notNull(),
    checksum: text('checksum').notNull(),
    mediaType: text('media_type').notNull(),
    sizeBytes: instant('size_bytes').notNull(),
    policyState: text('policy_state').notNull().default('pending'),
    createdAt: instant('created_at').notNull(),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    unique('attachment_project_id').on(t.projectId, t.id),
    foreignKey({
      columns: [t.projectId, t.uploadIntentId],
      foreignColumns: [uploadIntents.projectId, uploadIntents.id],
      name: 'attachment_intent_project_fk',
    }),
    foreignKey({
      columns: [t.projectId, t.issueId],
      foreignColumns: [issues.projectId, issues.id],
      name: 'attachment_issue_project_fk',
    }),
    foreignKey({
      columns: [t.projectId, t.commentId],
      foreignColumns: [comments.projectId, comments.id],
      name: 'attachment_comment_project_fk',
    }),
    check(
      'attachment_one_target',
      sql`(${t.issueId} IS NOT NULL AND ${t.commentId} IS NULL) OR (${t.issueId} IS NULL AND ${t.commentId} IS NOT NULL)`,
    ),
    check(
      'attachment_policy_state',
      sql`${t.policyState} IN ('pending','ready','quarantined','deleted')`,
    ),
    check(
      'attachment_size',
      sql`${t.sizeBytes} BETWEEN 0 AND 9007199254740991 AND cast(${t.sizeBytes} as bigint) = ${t.sizeBytes}`,
    ),
    check(
      'attachment_object',
      sql`length(${t.objectKey}) BETWEEN 1 AND 1024 AND length(${t.objectVersion}) BETWEEN 1 AND 1024 AND length(${t.checksum}) BETWEEN 1 AND 128 AND length(${t.mediaType}) BETWEEN 1 AND 255`,
    ),
    index('attachment_issue').on(t.projectId, t.issueId, t.id),
    index('attachment_comment').on(t.projectId, t.commentId, t.id),
    validId('attachment_id', t.id),
    revisionCheck('attachment_revision', t.revision),
    validTime('attachment_created', t.createdAt),
  ],
);

export const pluginInstallations = table(
  'plugin_installations',
  {
    id: id('id').primaryKey(),
    projectId: id('project_id').references(() => projects.id),
    scopeKey: text('scope_key').notNull(),
    pluginId: text('plugin_id').notNull(),
    pluginVersion: text('plugin_version').notNull(),
    manifestVersion: integer('manifest_version').notNull(),
    enabled: integer('enabled').notNull().default(0),
    revision: integer('revision').notNull().default(1),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    unique('plugin_installation_scope_id').on(t.scopeKey, t.id),
    unique('plugin_installation_scope_plugin').on(t.scopeKey, t.pluginId),
    check(
      'plugin_installation_scope',
      sql`${t.scopeKey} = coalesce(cast(${t.projectId} as text), 'deployment')`,
    ),
    check(
      'plugin_installation_names',
      sql`length(${t.pluginId}) BETWEEN 1 AND 100 AND length(${t.pluginVersion}) BETWEEN 1 AND 100`,
    ),
    validId('plugin_installation_id', t.id),
    flagCheck('plugin_installation_enabled', t.enabled),
    revisionCheck('plugin_installation_revision', t.revision),
    revisionCheck('plugin_manifest_version', t.manifestVersion),
    validTime('plugin_installation_created', t.createdAt),
  ],
);

export const pluginMetadata = table(
  'plugin_metadata',
  {
    installationId: id('installation_id').notNull(),
    scopeKey: text('scope_key').notNull(),
    namespace: text('namespace').notNull(),
    ownerType: text('owner_type').notNull(),
    ownerId: id('owner_id').notNull(),
    key: text('key').notNull(),
    value: json('value').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    primaryKey({
      columns: [t.installationId, t.namespace, t.ownerType, t.ownerId, t.key],
    }),
    foreignKey({
      columns: [t.scopeKey, t.installationId],
      foreignColumns: [pluginInstallations.scopeKey, pluginInstallations.id],
      name: 'plugin_metadata_scope_fk',
    }),
    check(
      'plugin_metadata_names',
      sql`length(${t.namespace}) BETWEEN 1 AND 100 AND length(${t.ownerType}) BETWEEN 1 AND 100 AND length(${t.key}) BETWEEN 1 AND 100`,
    ),
    index('plugin_metadata_owner').on(t.scopeKey, t.ownerType, t.ownerId),
    validId('plugin_metadata_owner_id', t.ownerId),
    revisionCheck('plugin_metadata_schema_version', t.schemaVersion),
    revisionCheck('plugin_metadata_revision', t.revision),
    validJson('plugin_metadata_value', t.value),
  ],
);

// Authoritative security metadata. Raw key material is never stored here.
export const keyRegistryControl = table(
  'key_registry_control',
  {
    singleton: integer('singleton').primaryKey(),
    generation: integer('generation').notNull(),
  },
  (t) => [
    check('key_registry_singleton', sql`${t.singleton} = 1`),
    revisionCheck('key_registry_generation', t.generation),
  ],
);

export const keyVersions = table(
  'key_versions',
  {
    purpose: text('purpose').notNull(),
    keyId: text('key_id').notNull(),
    version: integer('version').notNull(),
    state: text('state').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.purpose, t.keyId, t.version] }),
    check(
      'key_purpose',
      sql`${t.purpose} IN ('token-hmac','blind-index','envelope-kek','password-pepper')`,
    ),
    check('key_id_length', sql`length(${t.keyId}) BETWEEN 1 AND 64`),
    revisionCheck('key_version', t.version),
    check(
      'key_state',
      sql`${t.state} IN ('current','previous','revoked','removed')`,
    ),
    uniqueIndex('key_one_current')
      .on(t.purpose)
      .where(sql`${t.state} = 'current'`),
    index('key_state_purpose').on(t.state, t.purpose),
    index('key_active_versions')
      .on(t.purpose, t.keyId, t.version)
      .where(sql`${t.state} != 'removed'`),
    validTime('key_created', t.createdAt),
  ],
);

export const protectedRecords = table(
  'protected_records',
  {
    id: id('id').primaryKey(),
    revision: integer('revision').notNull(),
    purpose: text('purpose').notNull(),
    keyId: text('key_id').notNull(),
    keyVersion: integer('key_version').notNull(),
    record: json('record').notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.purpose, t.keyId, t.keyVersion],
      foreignColumns: [
        keyVersions.purpose,
        keyVersions.keyId,
        keyVersions.version,
      ],
      name: 'protected_record_key_fk',
    }),
    index('protected_record_key').on(t.purpose, t.keyId, t.keyVersion, t.id),
    validId('protected_record_id', t.id),
    revisionCheck('protected_record_revision', t.revision),
    validJson('protected_record_json', t.record),
    check(
      'protected_record_reference',
      sql`coalesce(json_extract(${t.record}, '$.key.purpose') = ${t.purpose} AND json_extract(${t.record}, '$.key.id') = ${t.keyId} AND json_extract(${t.record}, '$.key.version') = ${t.keyVersion}, false)`,
    ),
  ],
);

export const keyBackups = table(
  'key_backups',
  {
    id: id('id').primaryKey(),
    state: text('state').notNull(),
    retainUntil: instant('retain_until').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    validId('key_backup_id', t.id),
    check(
      'key_backup_state',
      sql`${t.state} IN ('capturing','retained','released')`,
    ),
    check('key_backup_retention', sql`${t.retainUntil} > ${t.createdAt}`),
    validTime('key_backup_created', t.createdAt),
    validTime('key_backup_until', t.retainUntil),
    index('key_backup_state_index').on(t.state),
  ],
);

export const keyBackupReferences = table(
  'key_backup_references',
  {
    backupId: id('backup_id')
      .notNull()
      .references(() => keyBackups.id),
    purpose: text('purpose').notNull(),
    keyId: text('key_id').notNull(),
    keyVersion: integer('key_version').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.backupId, t.purpose, t.keyId, t.keyVersion] }),
    foreignKey({
      columns: [t.purpose, t.keyId, t.keyVersion],
      foreignColumns: [
        keyVersions.purpose,
        keyVersions.keyId,
        keyVersions.version,
      ],
      name: 'key_backup_reference_fk',
    }),
    index('key_backup_reference_key').on(
      t.purpose,
      t.keyId,
      t.keyVersion,
      t.backupId,
    ),
  ],
);

export const rateLimitCounters = table(
  'rate_limit_counters',
  {
    category: text('category').notNull(),
    dimension: text('dimension').notNull(),
    keyVersion: integer('key_version').notNull(),
    subjectDigest: text('subject_digest').notNull(),
    windowStart: instant('window_start').notNull(),
    hits: integer('hits').notNull(),
    expiresAt: instant('expires_at').notNull(),
  },
  (t) => [
    primaryKey({
      columns: [
        t.category,
        t.dimension,
        t.keyVersion,
        t.subjectDigest,
        t.windowStart,
      ],
    }),
    index('rate_limit_expiry').on(t.expiresAt),
    check(
      'rate_limit_category',
      sql`${t.category} IN ('login','password-reset','registration','issue-create','comment-create','reaction','search','attachment-upload','api-token-create','webhook-configure')`,
    ),
    check(
      'rate_limit_dimension',
      sql`${t.dimension} IN ('ip','account','principal','project','token','route')`,
    ),
    check(
      'rate_limit_key_version',
      sql`${t.keyVersion} BETWEEN 1 AND 2147483647`,
    ),
    check(
      'rate_limit_digest',
      sql`length(${t.subjectDigest}) = 64 AND ${t.subjectDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check('rate_limit_hits', sql`${t.hits} BETWEEN 1 AND 2147483647`),
    check('rate_limit_expiry_order', sql`${t.expiresAt} > ${t.windowStart}`),
    validTime('rate_limit_window_start', t.windowStart),
    validTime('rate_limit_expires_at', t.expiresAt),
  ],
);

/** Optional Free-tier login lockout; no raw account identifier is retained. */
export const accountLockouts = table(
  'account_lockouts',
  {
    keyVersion: integer('key_version').notNull(),
    subjectDigest: text('subject_digest').notNull(),
    failedAttempts: integer('failed_attempts').notNull(),
    notBefore: instant('not_before').notNull(),
    expiresAt: instant('expires_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.keyVersion, t.subjectDigest] }),
    index('account_lockout_expiry').on(t.expiresAt),
    check(
      'account_lockout_key_version',
      sql`${t.keyVersion} BETWEEN 1 AND 2147483647`,
    ),
    check(
      'account_lockout_digest',
      sql`length(${t.subjectDigest}) = 64 AND ${t.subjectDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      'account_lockout_failures',
      sql`${t.failedAttempts} BETWEEN 1 AND 2147483647`,
    ),
    check('account_lockout_time_order', sql`${t.expiresAt} >= ${t.notBefore}`),
    validTime('account_lockout_not_before', t.notBefore),
    validTime('account_lockout_expires_at', t.expiresAt),
  ],
);

/** Deployment-scoped roles; separate from project roles (04.3b). */
export const instanceRoles = table(
  'instance_roles',
  {
    principalId: id('principal_id')
      .primaryKey()
      .references(() => principals.id),
    role: text('role').notNull().default('instance-administrator'),
    grantedAt: instant('granted_at').notNull(),
    grantedBy: id('granted_by').references(() => principals.id),
  },
  (t) => [
    check('instance_role_value', sql`${t.role} = 'instance-administrator'`),
    check(
      'instance_role_no_self_grant',
      sql`${t.grantedBy} IS NULL OR ${t.grantedBy} <> ${t.principalId}`,
    ),
    validTime('instance_role_granted_at', t.grantedAt),
  ],
);
/** First-party authorization sessions; no plaintext cookie credential. */
export const authorizationSessions = table(
  'authorization_sessions',
  {
    id: id('id').primaryKey(),
    principalId: id('principal_id')
      .notNull()
      .references(() => principals.id),
    identityId: id('identity_id')
      .notNull()
      .references(() => identities.id),
    credentialRevision: integer('credential_revision').notNull(),
    authMethod: text('auth_method').notNull().default('password'),
    authenticatedAt: instant('authenticated_at').notNull(),
    assurance: integer('assurance').notNull().default(1),
    digest: json('digest').notNull(),
    createdAt: instant('created_at').notNull(),
    idleExpiresAt: instant('idle_expires_at').notNull(),
    absoluteExpiresAt: instant('absolute_expires_at').notNull(),
    revokedAt: instant('revoked_at'),
  },
  (t) => [
    check(
      'authorization_session_auth_method',
      sql`${t.authMethod} IN ('password','passkey','recovery','bootstrap')`,
    ),
    index('authorization_session_principal').on(t.principalId, t.id),
    index('authorization_session_expiry').on(t.absoluteExpiresAt),
    index('authorization_session_idle_expiry').on(t.idleExpiresAt, t.id),
    index('authorization_session_revoked_expiry').on(t.revokedAt, t.id),
    validId('authorization_session_id', t.id),
    validTime('authorization_session_created', t.createdAt),
    validTime('authorization_session_idle', t.idleExpiresAt),
    validTime('authorization_session_absolute', t.absoluteExpiresAt),
    validTime('authorization_session_revoked', t.revokedAt),
    validJson('authorization_session_digest', t.digest),
    check('authorization_session_assurance', sql`${t.assurance} IN (1,2)`),
    check(
      'authorization_session_authenticated',
      sql`${t.authenticatedAt} BETWEEN 0 AND ${t.createdAt}`,
    ),
    check(
      'authorization_session_revision',
      sql`${t.credentialRevision} BETWEEN 1 AND 2147483647`,
    ),
    check(
      'authorization_session_time_order',
      sql`${t.idleExpiresAt} > ${t.createdAt} AND ${t.absoluteExpiresAt} >= ${t.idleExpiresAt} AND (${t.revokedAt} IS NULL OR ${t.revokedAt} >= ${t.createdAt})`,
    ),
  ],
);
/** Single-use account recovery codes; only keyed digests are stored. */
export const recoveryCodes = table(
  'recovery_codes',
  {
    id: id('id').primaryKey(),
    identityId: id('identity_id')
      .notNull()
      .references(() => identities.id),
    generation: integer('generation').notNull(),
    digest: json('digest').notNull(),
    createdAt: instant('created_at').notNull(),
    usedAt: instant('used_at'),
  },
  (t) => [
    index('recovery_code_identity').on(t.identityId, t.generation),
    validId('recovery_code_id', t.id),
    validTime('recovery_code_created', t.createdAt),
    validTime('recovery_code_used', t.usedAt),
    validJson('recovery_code_digest', t.digest),
    check(
      'recovery_code_generation',
      sql`${t.generation} BETWEEN 1 AND 2147483647`,
    ),
    check(
      'recovery_code_time_order',
      sql`(${t.usedAt} IS NULL OR ${t.usedAt} >= ${t.createdAt})`,
    ),
  ],
);

/** WebAuthn passkey credentials and one-time ceremony challenges. */
export const passkeyCredentials = table(
  'passkey_credentials',
  {
    id: text('id').primaryKey(),
    identityId: id('identity_id')
      .notNull()
      .references(() => identities.id),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull(),
    transports: text('transports'),
    deviceType: text('device_type').notNull(),
    backedUp: integer('backed_up').notNull(),
    aaguid: text('aaguid').notNull(),
    createdAt: instant('created_at').notNull(),
    lastUsedAt: instant('last_used_at'),
  },
  (t) => [
    index('passkey_identity').on(t.identityId),
    check('passkey_id_bound', sql`length(${t.id}) BETWEEN 1 AND 1024`),
    check(
      'passkey_public_key_bound',
      sql`length(${t.publicKey}) BETWEEN 1 AND 4096`,
    ),
    check('passkey_counter', sql`${t.counter} BETWEEN 0 AND 2147483647`),
    check(
      'passkey_device_type',
      sql`${t.deviceType} IN ('singleDevice', 'multiDevice')`,
    ),
    check('passkey_backed_up', sql`${t.backedUp} IN (0, 1)`),
    check('passkey_aaguid_bound', sql`length(${t.aaguid}) = 36`),
    validTime('passkey_created', t.createdAt),
    check(
      'passkey_last_used',
      sql`(${t.lastUsedAt} IS NULL OR (${t.lastUsedAt} BETWEEN 0 AND 8640000000000000 AND ${t.lastUsedAt} >= ${t.createdAt}))`,
    ),
  ],
);

export const webauthnChallenges = table(
  'webauthn_challenges',
  {
    id: id('id').primaryKey(),
    kind: text('kind').notNull(),
    challenge: text('challenge').notNull(),
    identityId: id('identity_id'),
    createdAt: instant('created_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
    consumedAt: instant('consumed_at'),
  },
  (t) => [
    uniqueIndex('webauthn_challenge_value').on(t.challenge),
    index('webauthn_challenge_expiry').on(t.expiresAt),
    validId('webauthn_challenge_id', t.id),
    check(
      'webauthn_challenge_kind',
      sql`${t.kind} IN ('registration', 'authentication')`,
    ),
    check(
      'webauthn_challenge_value',
      sql`length(${t.challenge}) BETWEEN 16 AND 256`,
    ),
    check(
      'webauthn_challenge_time',
      sql`${t.expiresAt} > ${t.createdAt} AND ${t.expiresAt} BETWEEN 0 AND 8640000000000000 AND (${t.consumedAt} IS NULL OR ${t.consumedAt} >= ${t.createdAt})`,
    ),
  ],
);

/** Single-use authorization codes bound to client, redirect URI and PKCE. */
export const oauthCodes = table(
  'oauth_codes',
  {
    id: id('id').primaryKey(),
    digest: json('digest').notNull(),
    clientId: text('client_id').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    scope: text('scope').notNull(),
    codeChallenge: text('code_challenge').notNull(),
    principalId: id('principal_id')
      .notNull()
      .references(() => principals.id),
    identityId: id('identity_id')
      .notNull()
      .references(() => identities.id),
    authMethod: text('auth_method').notNull().default('password'),
    authenticatedAt: instant('authenticated_at').notNull(),
    assurance: integer('assurance').notNull().default(1),
    createdAt: instant('created_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
    consumedAt: instant('consumed_at'),
  },
  (t) => [
    check(
      'oauth_code_auth_method',
      sql`${t.authMethod} IN ('password','passkey','recovery','bootstrap')`,
    ),
    index('oauth_code_expiry').on(t.expiresAt),
    validId('oauth_code_id', t.id),
    check(
      'oauth_code_client_bound',
      sql`length(${t.clientId}) BETWEEN 1 AND 128`,
    ),
    check(
      'oauth_code_redirect_bound',
      sql`length(${t.redirectUri}) BETWEEN 1 AND 2048`,
    ),
    check('oauth_code_scope_bound', sql`length(${t.scope}) BETWEEN 1 AND 256`),
    check(
      'oauth_code_challenge_bound',
      sql`length(${t.codeChallenge}) BETWEEN 43 AND 128`,
    ),
    validJson('oauth_code_digest', t.digest),
    validTime('oauth_code_created', t.createdAt),
    validTime('oauth_code_expires', t.expiresAt),
    validTime('oauth_code_consumed', t.consumedAt),
    check(
      'oauth_code_time_order',
      sql`${t.expiresAt} > ${t.createdAt} AND ${t.expiresAt} <= ${t.createdAt} + 60000 AND (${t.consumedAt} IS NULL OR ${t.consumedAt} >= ${t.createdAt})`,
    ),
  ],
);

/** Opaque bearer access tokens; only keyed digests are stored. */
export const oauthAccessTokens = table(
  'oauth_access_tokens',
  {
    id: id('id').primaryKey(),
    digest: json('digest').notNull(),
    principalId: id('principal_id')
      .notNull()
      .references(() => principals.id),
    identityId: id('identity_id')
      .notNull()
      .references(() => identities.id),
    clientId: text('client_id').notNull(),
    scope: text('scope').notNull(),
    authMethod: text('auth_method').notNull().default('password'),
    authenticatedAt: instant('authenticated_at').notNull(),
    assurance: integer('assurance').notNull().default(1),
    createdAt: instant('created_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
    revokedAt: instant('revoked_at'),
  },
  (t) => [
    check(
      'oauth_token_auth_method',
      sql`${t.authMethod} IN ('password','passkey','recovery','bootstrap')`,
    ),
    index('oauth_access_token_principal').on(t.principalId, t.id),
    index('oauth_access_token_expiry').on(t.expiresAt),
    validId('oauth_token_id', t.id),
    check(
      'oauth_token_client_bound',
      sql`length(${t.clientId}) BETWEEN 1 AND 128`,
    ),
    check('oauth_token_scope_bound', sql`length(${t.scope}) BETWEEN 1 AND 256`),
    validJson('oauth_token_digest', t.digest),
    validTime('oauth_token_created', t.createdAt),
    validTime('oauth_token_expires', t.expiresAt),
    validTime('oauth_token_revoked', t.revokedAt),
    check(
      'oauth_token_time_order',
      sql`${t.expiresAt} > ${t.createdAt} AND ${t.expiresAt} - ${t.createdAt} BETWEEN 300000 AND 900000 AND (${t.revokedAt} IS NULL OR ${t.revokedAt} >= ${t.createdAt})`,
    ),
  ],
);
/** Deployment-level plugin registry: one row per installed plugin id. */
export const pluginRegistry = table(
  'plugin_registry',
  {
    id: text('id').primaryKey(),
    version: text('version').notNull(),
    state: text('state').notNull(),
    manifest: json('manifest').notNull(),
    registeredAt: instant('registered_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [
    check(
      'plugin_registry_id',
      sql`length(${t.id}) BETWEEN 3 AND 128 AND ${t.id} LIKE '@%' AND ${t.id} NOT GLOB '*[^a-z0-9@/-]*' AND length(${t.id}) - length(replace(${t.id}, '/', '')) = 1`,
    ),
    check(
      'plugin_registry_version',
      sql`length(${t.version}) BETWEEN 5 AND 64`,
    ),
    check(
      'plugin_registry_state',
      sql`${t.state} IN ('registered','enabled','disabled')`,
    ),
    validJson('plugin_registry_manifest', t.manifest),
    validTime('plugin_registry_registered', t.registeredAt),
    validTime('plugin_registry_updated', t.updatedAt),
    check(
      'plugin_registry_time_order',
      sql`${t.updatedAt} >= ${t.registeredAt}`,
    ),
  ],
);
/** Namespaced plugin configuration: public values stored, secrets only as envelopes. */
export const pluginSettings = table(
  'plugin_settings',
  {
    id: id('id').primaryKey(),
    pluginId: text('plugin_id').notNull(),
    settingKey: text('setting_key').notNull(),
    kind: text('kind').notNull(),
    publicValue: text('public_value'),
    secretRecord: json('secret_record'),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('plugin_setting_namespace').on(t.pluginId, t.settingKey),
    validId('plugin_setting_id', t.id),
    check(
      'plugin_settings_id',
      sql`length(${t.pluginId}) BETWEEN 3 AND 128 AND ${t.pluginId} LIKE '@%' AND ${t.pluginId} NOT GLOB '*[^a-z0-9@/-]*' AND length(${t.pluginId}) - length(replace(${t.pluginId}, '/', '')) = 1`,
    ),
    check(
      'plugin_settings_key',
      sql`${t.settingKey} GLOB '[a-z]*' AND ${t.settingKey} NOT GLOB '*[^a-z0-9-]*' AND length(${t.settingKey}) BETWEEN 1 AND 64`,
    ),
    check('plugin_settings_kind', sql`${t.kind} IN ('public','secret')`),
    check(
      'plugin_settings_shape',
      sql`(${t.kind} = 'public' AND ${t.publicValue} IS NOT NULL AND ${t.secretRecord} IS NULL) OR (${t.kind} = 'secret' AND ${t.publicValue} IS NULL)`,
    ),
    validJson('plugin_settings_secret', t.secretRecord),
    validTime('plugin_settings_updated', t.updatedAt),
  ],
);
/** Module 05 outbox-model event rows: §11.5 envelopes, at-least-once, dispatch is module 09's. */
export const pluginEventOutbox = table(
  'plugin_event_outbox',
  {
    eventId: id('event_id').primaryKey(),
    pluginId: text('plugin_id').notNull(),
    point: text('point').notNull(),
    payloadVersion: integer('payload_version').notNull(),
    payload: json('payload').notNull(),
    createdAt: instant('created_at').notNull(),
    availableAt: instant('available_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    deliveredAt: instant('delivered_at'),
  },
  (t) => [
    index('plugin_event_pending').on(t.deliveredAt, t.availableAt, t.eventId),
    index('plugin_event_pending_age').on(t.deliveredAt, t.createdAt, t.eventId),
    index('plugin_event_plugin').on(t.pluginId, t.createdAt),
    check(
      'plugin_event_id_scope',
      sql`length(${t.pluginId}) BETWEEN 3 AND 128 AND ${t.pluginId} LIKE '@%'`,
    ),
    check(
      'plugin_event_point_bound',
      sql`length(${t.point}) BETWEEN 3 AND 128`,
    ),
    check(
      'plugin_event_attempts',
      sql`${t.attempts} >= 0 AND ${t.attempts} <= 2147483647`,
    ),
    check(
      'plugin_event_version',
      sql`${t.payloadVersion} >= 1 AND ${t.payloadVersion} <= 2147483647`,
    ),
    validJson('plugin_event_payload', t.payload),
    validTime('plugin_event_created', t.createdAt),
    validTime('plugin_event_available', t.availableAt),
    validTime('plugin_event_delivered', t.deliveredAt),
    check(
      'plugin_event_time_order',
      sql`${t.availableAt} >= ${t.createdAt} AND (${t.deliveredAt} IS NULL OR ${t.deliveredAt} >= ${t.createdAt})`,
    ),
    validId('plugin_event_id', t.eventId),
  ],
);

/** Derived search state only. Canonical Issue revision and visibility remain authoritative. */
export const searchDocuments = table(
  'search_documents',
  {
    rowid: integer('rowid').primaryKey({ autoIncrement: true }),
    issueId: id('issue_id').notNull(),
    projectId: id('project_id').notNull(),
    revision: integer('revision').notNull(),
    projectionVersion: text('projection_version'),
    active: integer('active').notNull().default(0),
    scope: text('scope').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
  },
  (t) => [
    unique('search_issue').on(t.issueId),
    index('search_project_issue').on(t.projectId, t.issueId),
    foreignKey({
      columns: [t.projectId, t.issueId],
      foreignColumns: [issues.projectId, issues.id],
      name: 'search_issue_fk',
    }),
    check('search_revision', sql`${t.revision} BETWEEN 1 AND 2147483647`),
    check('search_active', sql`${t.active} IN (0,1)`),
  ],
);

/** Singleton daily search reservation ledger; no identity or query text. */
export const searchBudget = table(
  'search_budget',
  {
    id: integer('id').primaryKey(),
    day: integer('day').notNull(),
    reads: integer('reads').notNull(),
    writes: integer('writes').notNull(),
  },
  (t) => [
    check('search_budget_singleton', sql`${t.id} = 1`),
    check(
      'search_budget_bounds',
      sql`${t.day} >= 0 AND ${t.reads} BETWEEN 0 AND 1000000 AND ${t.writes} BETWEEN 0 AND 20000`,
    ),
  ],
);

/** Module 09 sidecars leave the producer outboxes and envelopes unchanged. */
export const asyncDeliveries = table(
  'async_deliveries',
  {
    deliveryId: text('delivery_id').primaryKey(),
    source: text('source').notNull(),
    eventId: id('event_id').notNull(),
    state: text('state').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    publicationAttempts: integer('publication_attempts').notNull().default(0),
    availableAt: instant('available_at').notNull(),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
    publishToken: text('publish_token'),
    publishUntil: instant('publish_until').notNull().default(0),
    workToken: text('work_token'),
    workUntil: instant('work_until').notNull().default(0),
    failure: text('failure'),
  },
  (t) => [
    unique('async_source_event').on(t.source, t.eventId),
    index('async_pending').on(t.state, t.availableAt, t.deliveryId),
    index('async_terminal').on(t.state, t.updatedAt, t.deliveryId),
    check('async_source', sql`${t.source} IN ('core','plugin')`),
    check('async_state', sql`${t.state} IN ('pending','done','failed')`),
    check(
      'async_attempts',
      sql`${t.attempts} BETWEEN 0 AND 5 AND ${t.publicationAttempts} BETWEEN 0 AND 5`,
    ),
    check(
      'async_failure',
      sql`${t.failure} IS NULL OR ${t.failure} IN ('invalid','unsupported','permanent','transient','timeout','lease-exhausted')`,
    ),
    validId('async_event_id', t.eventId),
    validTime('async_created', t.createdAt),
    validTime('async_available', t.availableAt),
    validTime('async_updated', t.updatedAt),
  ],
);
export const asyncJobs = table(
  'async_jobs',
  {
    id: id('id').primaryKey(),
    kind: text('kind').notNull().default('conformance'),
    status: text('status').notNull().default('pending'),
    checkpoint: integer('checkpoint').notNull().default(0),
    progress: integer('progress').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),
    maxSteps: integer('max_steps').notNull(),
    resultReference: text('result_reference'),
    leaseToken: text('lease_token'),
    leaseUntil: instant('lease_until').notNull().default(0),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [
    index('async_job_pending').on(t.status, t.leaseUntil, t.id),
    index('async_job_terminal').on(t.status, t.updatedAt, t.id),
    check(
      'async_job_status',
      sql`${t.status} IN ('pending','running','completed','failed','cancelled')`,
    ),
    check('async_job_kind', sql`${t.kind} = 'conformance'`),
    check(
      'async_job_bounds',
      sql`${t.maxSteps} BETWEEN 1 AND 16 AND ${t.checkpoint} BETWEEN 0 AND ${t.maxSteps} AND ${t.progress} BETWEEN 0 AND 100 AND ${t.attempts} BETWEEN 0 AND 5`,
    ),
    check(
      'async_job_result_bound',
      sql`${t.resultReference} IS NULL OR length(${t.resultReference}) <= 512`,
    ),
    validId('async_job_id', t.id),
    validTime('async_job_updated', t.updatedAt),
    validTime('async_job_created', t.createdAt),
  ],
);
export const asyncJobSteps = table(
  'async_job_steps',
  {
    jobId: id('job_id')
      .notNull()
      .references(() => asyncJobs.id),
    step: integer('step').notNull(),
    committedAt: instant('committed_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.jobId, t.step] }),
    check('async_step_bound', sql`${t.step} BETWEEN 0 AND 15`),
    validTime('async_step_time', t.committedAt),
  ],
);

export const asyncMaintenance = table(
  'async_maintenance',
  {
    name: text('name').primaryKey(),
    projectId: id('project_id'),
    temporary: text('temporary'),
    orphan: text('orphan'),
    leaseToken: text('lease_token'),
    leaseUntil: instant('lease_until').notNull().default(0),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [
    check('async_maintenance_name', sql`${t.name} = 'uploads'`),
    check(
      'async_maintenance_checkpoint',
      sql`(${t.temporary} IS NULL OR length(${t.temporary}) <= 1024) AND (${t.orphan} IS NULL OR length(${t.orphan}) <= 1024)`,
    ),
    validTime('async_maintenance_time', t.updatedAt),
  ],
);

export const asyncMinimumBudget = table(
  'async_minimum_budget',
  {
    id: integer('id').primaryKey(),
    day: integer('day').notNull(),
    reads: integer('reads').notNull(),
    writes: integer('writes').notNull(),
  },
  (t) => [
    check(
      'async_minimum_budget_bounds',
      sql`${t.id}=1 AND ${t.day}>=0 AND ${t.reads} BETWEEN 0 AND 1500000 AND ${t.writes} BETWEEN 0 AND 30000`,
    ),
  ],
);
export const asyncMinimumCursors = table(
  'async_minimum_cursors',
  {
    source: text('source').primaryKey(),
    availableAt: instant('available_at').notNull(),
    eventId: text('event_id').notNull(),
  },
  (t) => [
    check('async_minimum_cursor_source', sql`${t.source} IN ('core','plugin')`),
  ],
);
