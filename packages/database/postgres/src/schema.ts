import { sql, type SQLWrapper } from 'drizzle-orm';
import {
  pgTable as table,
  text,
  integer,
  uuid,
  bigint,
  jsonb,
  unique,
  index,
  check,
  foreignKey,
  primaryKey,
} from 'drizzle-orm/pg-core';
const id = (name: string) => uuid(name);
const instant = (name: string) => bigint(name, { mode: 'number' });
const json = (name: string) => jsonb(name);
const validId = (name: string, column: SQLWrapper) =>
  check(
    name,
    sql`substr(${column}::text,15,1) = '4' AND substr(${column}::text,20,1) IN ('8','9','a','b')`,
  );
const validTime = (name: string, column: SQLWrapper) =>
  check(name, sql`${column} BETWEEN 0 AND 8640000000000000`);
const validJson = (name: string, column: SQLWrapper) =>
  check(name, sql`length(${column}::text) <= 65536`);

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
