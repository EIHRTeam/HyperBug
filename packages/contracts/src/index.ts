import { SafeMarkdownTreeSchema } from './markdown.ts';
export * from './markdown.ts';
export * from './uploads.ts';
export * from './content-definitions.ts';
import { Type, type Static } from '@sinclair/typebox';

export const ErrorSchema = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String(),
        message: Type.String(),
        requestId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type ErrorResponse = Static<typeof ErrorSchema>;
export const HealthSchema = Type.Object(
  { status: Type.Union([Type.Literal('ok'), Type.Literal('unavailable')]) },
  { additionalProperties: false },
);
export const ReadinessSchema = Type.Object(
  {
    status: Type.Union([Type.Literal('ok'), Type.Literal('unavailable')]),
    deployment: Type.Object(
      {
        tier: Type.Union([
          Type.Literal('standard'),
          Type.Literal('cloudflare-free-minimum'),
        ]),
        degradationIds: Type.Array(Type.String({ pattern: '^FREE-0[1-8]$' }), {
          maxItems: 8,
          uniqueItems: true,
        }),
        passwordHashPolicy: Type.Union([
          Type.Literal('argon2id'),
          Type.Literal('pbkdf2-hmac-sha256'),
        ]),
        bootstrapPending: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type ReadinessResponse = Static<typeof ReadinessSchema>;
export const InstanceDocumentSchema = Type.Object(
  {
    tier: Type.Union([
      Type.Literal('standard'),
      Type.Literal('cloudflare-free-minimum'),
    ]),
    degradationIds: Type.Array(Type.String({ pattern: '^FREE-0[1-8]$' }), {
      maxItems: 8,
      uniqueItems: true,
    }),
    passwordHashPolicy: Type.Object(
      {
        algorithm: Type.Union([
          Type.Literal('argon2id'),
          Type.Literal('pbkdf2-hmac-sha256'),
        ]),
        downgraded: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
    authentication: Type.Object(
      {
        passwordRegistration: Type.Boolean(),
        passwordLogin: Type.Boolean(),
        passkeys: Type.Boolean(),
        recoveryCodes: Type.Boolean(),
        administratorAssistedRecovery: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
    limits: Type.Object(
      { documented: Type.String({ minLength: 1, maxLength: 2048 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type InstanceDocument = Static<typeof InstanceDocumentSchema>;
export const RegistrationRequestSchema = Type.Object(
  {
    handle: Type.String({ pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$' }),
    password: Type.String({ minLength: 12, maxLength: 128 }),
    captchaToken: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
  },
  { additionalProperties: false },
);
export type RegistrationRequest = Static<typeof RegistrationRequestSchema>;
export const RegistrationAcceptedSchema = Type.Object(
  { accepted: Type.Literal(true) },
  { additionalProperties: false },
);
export type RegistrationAccepted = Static<typeof RegistrationAcceptedSchema>;
export const RegistrationChallengeSchema = Type.Object(
  {
    captchaRequired: Type.Boolean(),
    captchaSiteKey: Type.Union([Type.String(), Type.Null()]),
    captchaAction: Type.Literal('register'),
  },
  { additionalProperties: false },
);
export type RegistrationChallenge = Static<typeof RegistrationChallengeSchema>;
export const LoginRequestSchema = Type.Object(
  {
    handle: Type.String({ pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$' }),
    password: Type.String({ minLength: 12, maxLength: 128 }),
    captchaToken: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
  },
  { additionalProperties: false },
);
export type LoginRequest = Static<typeof LoginRequestSchema>;
export const LoginChallengeSchema = Type.Object(
  {
    captchaRequired: Type.Boolean(),
    captchaSiteKey: Type.Union([Type.String(), Type.Null()]),
    captchaAction: Type.Literal('login'),
  },
  { additionalProperties: false },
);
export type LoginChallenge = Static<typeof LoginChallengeSchema>;
export const AccountSessionSchema = Type.Object(
  { authenticated: Type.Literal(true) },
  { additionalProperties: false },
);
export type AccountSession = Static<typeof AccountSessionSchema>;
export const AccountDocumentSchema = Type.Object(
  {
    principalId: Type.String({ format: 'uuid' }),
    identityId: Type.String({ format: 'uuid' }),
    kind: Type.Union([Type.Literal('user'), Type.Literal('staff')]),
  },
  { additionalProperties: false },
);
export type AccountDocument = Static<typeof AccountDocumentSchema>;
export const BootstrapEnrollRequestSchema = Type.Object(
  {
    enrollmentCode: Type.String({ minLength: 1, maxLength: 128 }),
    handle: Type.String({ pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$' }),
    password: Type.String({ minLength: 12, maxLength: 128 }),
  },
  { additionalProperties: false },
);
export type BootstrapEnrollRequest = Static<
  typeof BootstrapEnrollRequestSchema
>;
export const BootstrapEnrolledSchema = Type.Object(
  { enrolled: Type.Literal(true) },
  { additionalProperties: false },
);
export type BootstrapEnrolled = Static<typeof BootstrapEnrolledSchema>;
export const RecoveryCodesSchema = Type.Object(
  {
    codes: Type.Array(Type.String({ minLength: 1, maxLength: 128 }), {
      minItems: 10,
      maxItems: 10,
    }),
  },
  { additionalProperties: false },
);
export type RecoveryCodes = Static<typeof RecoveryCodesSchema>;
export const RecoveryRequestSchema = Type.Object(
  {
    handle: Type.String({ pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$' }),
    recoveryCode: Type.String({ minLength: 1, maxLength: 128 }),
    password: Type.String({ minLength: 12, maxLength: 128 }),
  },
  { additionalProperties: false },
);
export type RecoveryRequest = Static<typeof RecoveryRequestSchema>;
export const RecoveredSchema = Type.Object(
  { recovered: Type.Literal(true) },
  { additionalProperties: false },
);
export type Recovered = Static<typeof RecoveredSchema>;
export const AuthorizeRequestSchema = Type.Object(
  {
    responseType: Type.String({ minLength: 1, maxLength: 64 }),
    clientId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,128}$' }),
    redirectUri: Type.String({ minLength: 1, maxLength: 2048 }),
    scope: Type.String({ minLength: 1, maxLength: 256 }),
    state: Type.String({ minLength: 1, maxLength: 2048 }),
    codeChallenge: Type.String({
      pattern: '^[A-Za-z0-9_-]{43,128}$',
    }),
    codeChallengeMethod: Type.String({ minLength: 1, maxLength: 16 }),
  },
  { additionalProperties: false },
);
export type AuthorizeRequest = Static<typeof AuthorizeRequestSchema>;
export const AuthorizeResponseSchema = Type.Object(
  { redirectUri: Type.String({ minLength: 1, maxLength: 4096 }) },
  { additionalProperties: false },
);
export type AuthorizeResponse = Static<typeof AuthorizeResponseSchema>;
export const TokenResponseSchema = Type.Object(
  {
    tokenType: Type.Literal('Bearer'),
    accessToken: Type.String({ minLength: 1, maxLength: 256 }),
    expiresIn: Type.Integer(),
    scope: Type.String({ minLength: 1, maxLength: 256 }),
  },
  { additionalProperties: false },
);
export type TokenResponse = Static<typeof TokenResponseSchema>;
const canonicalInstant = {
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
};
export const AccountSessionSummarySchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    createdAt: Type.String(canonicalInstant),
    idleExpiresAt: Type.String(canonicalInstant),
    absoluteExpiresAt: Type.String(canonicalInstant),
  },
  { additionalProperties: false },
);
export type AccountSessionSummary = Static<typeof AccountSessionSummarySchema>;
export const AccountSessionsSchema = Type.Object(
  {
    sessions: Type.Array(AccountSessionSummarySchema, {
      minItems: 0,
      maxItems: 50,
    }),
  },
  { additionalProperties: false },
);
export type AccountSessions = Static<typeof AccountSessionsSchema>;
export const PrincipalStatusSchema = Type.Object(
  {
    principalId: Type.String({ format: 'uuid' }),
    status: Type.Union([Type.Literal('active'), Type.Literal('suspended')]),
  },
  { additionalProperties: false },
);
export type PrincipalStatus = Static<typeof PrincipalStatusSchema>;
const MemberRoleSchema = Type.Union([
  Type.Literal('triage'),
  Type.Literal('maintainer'),
  Type.Literal('administrator'),
]);
export const ProjectMemberRoleRequestSchema = Type.Object(
  { role: MemberRoleSchema },
  { additionalProperties: false },
);
export type ProjectMemberRoleRequest = Static<
  typeof ProjectMemberRoleRequestSchema
>;
export const ProjectMemberRoleSchema = Type.Object(
  {
    projectId: Type.String({ format: 'uuid' }),
    principalId: Type.String({ format: 'uuid' }),
    role: MemberRoleSchema,
  },
  { additionalProperties: false },
);
export type ProjectMemberRole = Static<typeof ProjectMemberRoleSchema>;
export const EchoSchema = Type.Object(
  { message: Type.String({ minLength: 1, maxLength: 100 }) },
  { additionalProperties: false },
);
export type Echo = Static<typeof EchoSchema>;

export const PluginStateSchema = Type.Union([
  Type.Literal('registered'),
  Type.Literal('enabled'),
  Type.Literal('disabled'),
]);
export const PluginSummarySchema = Type.Object(
  {
    id: Type.String({
      pattern: '^@[a-z0-9][a-z0-9-]{0,62}/[a-z0-9][a-z0-9-]{0,62}$',
    }),
    version: Type.String({ pattern: '^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z-]+)?$' }),
    state: PluginStateSchema,
    registeredAt: Type.String(),
    updatedAt: Type.String(),
  },
  { additionalProperties: false },
);
export type PluginSummary = Static<typeof PluginSummarySchema>;
export const PluginRecordSchema = Type.Object(
  {
    id: Type.String(),
    version: Type.String(),
    state: PluginStateSchema,
    /** The validated manifest, opaque JSON for API consumers. */
    manifest: Type.Object({}, { additionalProperties: true }),
    registeredAt: Type.String(),
    updatedAt: Type.String(),
  },
  { additionalProperties: false },
);
export type PluginRecord = Static<typeof PluginRecordSchema>;
export const PluginListSchema = Type.Object(
  { plugins: Type.Array(PluginSummarySchema, { maxItems: 200 }) },
  { additionalProperties: false },
);
export type PluginList = Static<typeof PluginListSchema>;

const instantPattern = canonicalInstant;
const ProjectVisibilitySchema = Type.Union([
  Type.Literal('public'),
  Type.Literal('private'),
]);
const ProjectStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('archived'),
]);
export const ProjectDocumentSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    slug: Type.String({ pattern: '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' }),
    name: Type.String({ minLength: 1, maxLength: 100 }),
    visibility: ProjectVisibilitySchema,
    status: ProjectStatusSchema,
    revision: Type.Integer({ minimum: 1 }),
    createdAt: Type.String(instantPattern),
    updatedAt: Type.String(instantPattern),
  },
  { additionalProperties: false },
);
export type ProjectDocument = Static<typeof ProjectDocumentSchema>;
export const CreateProjectRequestSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1, maxLength: 63 }),
    name: Type.String({ minLength: 1, maxLength: 100 }),
    visibility: Type.Optional(ProjectVisibilitySchema),
  },
  { additionalProperties: false },
);
export type CreateProjectRequest = Static<typeof CreateProjectRequestSchema>;
export const ConfigureProjectRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    visibility: Type.Optional(ProjectVisibilitySchema),
  },
  { additionalProperties: false },
);
export type ConfigureProjectRequest = Static<
  typeof ConfigureProjectRequestSchema
>;
const TaxonomyColorSchema = Type.String({
  pattern: '^(#[0-9a-f]{6})?$',
  maxLength: 32,
});
export const LabelDocumentSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    name: Type.String({ minLength: 1, maxLength: 100 }),
    description: Type.String({ maxLength: 4096 }),
    color: TaxonomyColorSchema,
    revision: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);
export type LabelDocument = Static<typeof LabelDocumentSchema>;
export const LabelRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    description: Type.Optional(Type.String({ maxLength: 4096 })),
    color: Type.Optional(TaxonomyColorSchema),
  },
  { additionalProperties: false },
);
export type LabelRequest = Static<typeof LabelRequestSchema>;
export const LabelUpdateRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    description: Type.Optional(Type.String({ maxLength: 4096 })),
    color: Type.Optional(TaxonomyColorSchema),
  },
  { additionalProperties: false },
);
export type LabelUpdateRequest = Static<typeof LabelUpdateRequestSchema>;
export const LabelListSchema = Type.Object(
  { labels: Type.Array(LabelDocumentSchema, { maxItems: 500 }) },
  { additionalProperties: false },
);
export type LabelList = Static<typeof LabelListSchema>;
export const IssueTypeDocumentSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    name: Type.String({ minLength: 1, maxLength: 100 }),
    description: Type.String({ maxLength: 4096 }),
    icon: Type.String({ maxLength: 100 }),
    color: TaxonomyColorSchema,
    position: Type.Integer({ minimum: 0 }),
    enabled: Type.Boolean(),
    revision: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);
export type IssueTypeDocument = Static<typeof IssueTypeDocumentSchema>;
export const IssueTypeRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    description: Type.Optional(Type.String({ maxLength: 4096 })),
    icon: Type.Optional(Type.String({ maxLength: 100 })),
    color: Type.Optional(TaxonomyColorSchema),
    position: Type.Optional(Type.Integer({ minimum: 0 })),
    enabled: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type IssueTypeRequest = Static<typeof IssueTypeRequestSchema>;
export const IssueTypeUpdateRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    description: Type.Optional(Type.String({ maxLength: 4096 })),
    icon: Type.Optional(Type.String({ maxLength: 100 })),
    color: Type.Optional(TaxonomyColorSchema),
    position: Type.Optional(Type.Integer({ minimum: 0 })),
    enabled: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type IssueTypeUpdateRequest = Static<
  typeof IssueTypeUpdateRequestSchema
>;
export const IssueTypeListSchema = Type.Object(
  { types: Type.Array(IssueTypeDocumentSchema, { maxItems: 500 }) },
  { additionalProperties: false },
);
export type IssueTypeList = Static<typeof IssueTypeListSchema>;
export const MilestoneProgressSchema = Type.Object(
  {
    open: Type.Integer({ minimum: 0 }),
    closed: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export const MilestoneDocumentSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ maxLength: 32768 }),
    state: Type.Union([Type.Literal('open'), Type.Literal('closed')]),
    dueDate: Type.Union([
      Type.Null(),
      Type.String({
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        maxLength: 10,
      }),
    ]),
    revision: Type.Integer({ minimum: 1 }),
    createdAt: Type.String(instantPattern),
    updatedAt: Type.String(instantPattern),
    progress: MilestoneProgressSchema,
  },
  { additionalProperties: false },
);
export type MilestoneDocument = Static<typeof MilestoneDocumentSchema>;
export const MilestoneRequestSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.Optional(Type.String({ maxLength: 32768 })),
    dueDate: Type.Optional(
      Type.Union([
        Type.Null(),
        Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', maxLength: 10 }),
      ]),
    ),
  },
  { additionalProperties: false },
);
export type MilestoneRequest = Static<typeof MilestoneRequestSchema>;
export const MilestoneUpdateRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    description: Type.Optional(Type.String({ maxLength: 32768 })),
    dueDate: Type.Optional(
      Type.Union([
        Type.Null(),
        Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', maxLength: 10 }),
      ]),
    ),
    state: Type.Optional(
      Type.Union([Type.Literal('open'), Type.Literal('closed')]),
    ),
  },
  { additionalProperties: false },
);
export type MilestoneUpdateRequest = Static<
  typeof MilestoneUpdateRequestSchema
>;
export const MilestoneListSchema = Type.Object(
  { milestones: Type.Array(MilestoneDocumentSchema, { maxItems: 200 }) },
  { additionalProperties: false },
);
export type MilestoneList = Static<typeof MilestoneListSchema>;

const IssueModerationSchema = Type.Union([
  Type.Literal('visible'),
  Type.Literal('hidden'),
  Type.Literal('redacted'),
]);
const IssueStateSchema = Type.Union([
  Type.Literal('open'),
  Type.Literal('closed'),
]);
const CloseReasonSchema = Type.Union([
  Type.Literal('completed'),
  Type.Literal('not_planned'),
  Type.Literal('duplicate'),
  Type.Literal('invalid'),
  Type.Literal('cannot_reproduce'),
]);
/** Public safe element tree; no HTML strings or executable DOM properties. */
const ContentRepresentationFields = {
  bodyTree: Type.Optional(SafeMarkdownTreeSchema),
  contentPolicyVersion: Type.Optional(Type.String({ maxLength: 80 })),
  representationEtag: Type.Optional(Type.String({ maxLength: 200 })),
};
const ContentPreviewFields = {
  preview: Type.Union([Type.Null(), Type.String({ maxLength: 1120 })]),
  textProjectionVersion: Type.Union([
    Type.Null(),
    Type.String({ maxLength: 64 }),
  ]),
};

const IssueBaseSchema = {
  id: Type.String({ format: 'uuid' }),
  projectId: Type.String({ format: 'uuid' }),
  number: Type.Integer({ minimum: 1 }),
  title: Type.String({ minLength: 1, maxLength: 200 }),
  state: IssueStateSchema,
  closeReason: Type.Union([Type.Null(), CloseReasonSchema]),
  typeId: Type.Union([Type.Null(), Type.String({ format: 'uuid' })]),
  milestoneId: Type.Union([Type.Null(), Type.String({ format: 'uuid' })]),
  moderation: IssueModerationSchema,
  authorId: Type.String({ format: 'uuid' }),
  revision: Type.Integer({ minimum: 1 }),
  createdAt: Type.String(canonicalInstant),
  updatedAt: Type.String(canonicalInstant),
  closedAt: Type.Union([Type.Null(), Type.String(canonicalInstant)]),
  labelIds: Type.Array(Type.String({ format: 'uuid' }), { maxItems: 20 }),
  assigneeIds: Type.Array(Type.String({ format: 'uuid' }), { maxItems: 10 }),
};
export const IssueDocumentSchema = Type.Object(
  {
    ...IssueBaseSchema,
    ...ContentPreviewFields,
    ...ContentRepresentationFields,
    body: Type.String({ maxLength: 32768 }),
  },
  { additionalProperties: false },
);
export type IssueDocument = Static<typeof IssueDocumentSchema>;
export const IssueSummarySchema = Type.Object(
  {
    ...IssueBaseSchema,
    ...ContentPreviewFields,
    /** List projections never carry the Markdown body. */
    body: Type.Null(),
  },
  { additionalProperties: false },
);
export type IssueSummary = Static<typeof IssueSummarySchema>;
export const IssuePageSchema = Type.Object(
  {
    items: Type.Array(IssueSummarySchema, { maxItems: 100 }),
    nextCursor: Type.Union([Type.Null(), Type.String({ maxLength: 1024 })]),
  },
  { additionalProperties: false },
);
export type IssuePage = Static<typeof IssuePageSchema>;
export const CreateIssueRequestSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 200 }),
    body: Type.String({ maxLength: 32768 }),
    typeId: Type.Optional(
      Type.Union([Type.Null(), Type.String({ format: 'uuid' })]),
    ),
    milestoneId: Type.Optional(
      Type.Union([Type.Null(), Type.String({ format: 'uuid' })]),
    ),
    labelIds: Type.Optional(
      Type.Array(Type.String({ format: 'uuid' }), { maxItems: 20 }),
    ),
    assigneeIds: Type.Optional(
      Type.Array(Type.String({ format: 'uuid' }), { maxItems: 10 }),
    ),
  },
  { additionalProperties: false },
);
export type CreateIssueRequest = Static<typeof CreateIssueRequestSchema>;
export const EditIssueRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    body: Type.String({ maxLength: 32768 }),
  },
  { additionalProperties: false },
);
export type EditIssueRequest = Static<typeof EditIssueRequestSchema>;
export const IssueCloseRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    reason: CloseReasonSchema,
  },
  { additionalProperties: false },
);
export type IssueCloseRequest = Static<typeof IssueCloseRequestSchema>;
export const IssueRevisionRequestSchema = Type.Object(
  { expectedRevision: Type.Integer({ minimum: 1 }) },
  { additionalProperties: false },
);
export type IssueRevisionRequest = Static<typeof IssueRevisionRequestSchema>;
export const IssueSetLabelsRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    labelIds: Type.Array(Type.String({ format: 'uuid' }), { maxItems: 20 }),
  },
  { additionalProperties: false },
);
export type IssueSetLabelsRequest = Static<typeof IssueSetLabelsRequestSchema>;
export const IssueSetAssigneesRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    assigneeIds: Type.Array(Type.String({ format: 'uuid' }), { maxItems: 10 }),
  },
  { additionalProperties: false },
);
export type IssueSetAssigneesRequest = Static<
  typeof IssueSetAssigneesRequestSchema
>;
export const IssueSetTypeRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    typeId: Type.Union([Type.Null(), Type.String({ format: 'uuid' })]),
  },
  { additionalProperties: false },
);
export type IssueSetTypeRequest = Static<typeof IssueSetTypeRequestSchema>;
export const IssueSetMilestoneRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    milestoneId: Type.Union([Type.Null(), Type.String({ format: 'uuid' })]),
  },
  { additionalProperties: false },
);
export type IssueSetMilestoneRequest = Static<
  typeof IssueSetMilestoneRequestSchema
>;

const CommentModerationSchema = Type.Union([
  Type.Literal('visible'),
  Type.Literal('hidden'),
  Type.Literal('redacted'),
]);
const ReactionValueSchema = Type.Union([
  Type.Literal('thumbs_up'),
  Type.Literal('thumbs_down'),
  Type.Literal('laugh'),
  Type.Literal('hooray'),
  Type.Literal('confused'),
  Type.Literal('heart'),
  Type.Literal('rocket'),
  Type.Literal('eyes'),
]);
export const CommentDocumentSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    issueId: Type.String({ format: 'uuid' }),
    authorId: Type.String({ format: 'uuid' }),
    ...ContentPreviewFields,
    ...ContentRepresentationFields,
    body: Type.Optional(Type.String({ maxLength: 32768 })),
    revision: Type.Integer({ minimum: 1 }),
    moderation: CommentModerationSchema,
    deleted: Type.Boolean(),
    createdAt: Type.String(canonicalInstant),
    updatedAt: Type.String(canonicalInstant),
  },
  { additionalProperties: false },
);
export type CommentDocument = Static<typeof CommentDocumentSchema>;
export const CommentPageSchema = Type.Object(
  {
    comments: Type.Array(CommentDocumentSchema, { maxItems: 100 }),
    nextCursor: Type.Union([Type.Null(), Type.String({ maxLength: 1024 })]),
  },
  { additionalProperties: false },
);
export type CommentPage = Static<typeof CommentPageSchema>;
export const CreateCommentRequestSchema = Type.Object(
  { body: Type.String({ minLength: 1, maxLength: 32768 }) },
  { additionalProperties: false },
);
export type CreateCommentRequest = Static<typeof CreateCommentRequestSchema>;
export const EditCommentRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1 }),
    body: Type.String({ minLength: 1, maxLength: 32768 }),
  },
  { additionalProperties: false },
);
export type EditCommentRequest = Static<typeof EditCommentRequestSchema>;
export const CommentModerationRequestSchema = Type.Object(
  { moderation: CommentModerationSchema },
  { additionalProperties: false },
);
export type CommentModerationRequest = Static<
  typeof CommentModerationRequestSchema
>;
export const CommentHistoryEntrySchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    commentId: Type.String({ format: 'uuid' }),
    revision: Type.Integer({ minimum: 1 }),
    editorId: Type.String({ format: 'uuid' }),
    body: Type.String({ maxLength: 32768 }),
    changedAt: Type.String(canonicalInstant),
  },
  { additionalProperties: false },
);
export const CommentHistorySchema = Type.Object(
  { entries: Type.Array(CommentHistoryEntrySchema, { maxItems: 100 }) },
  { additionalProperties: false },
);
export type CommentHistory = Static<typeof CommentHistorySchema>;
export const ReactionRequestSchema = Type.Object(
  { reaction: ReactionValueSchema },
  { additionalProperties: false },
);
export type ReactionRequest = Static<typeof ReactionRequestSchema>;
export const ReactionSummarySchema = Type.Object(
  {
    reaction: ReactionValueSchema,
    count: Type.Integer({ minimum: 0, maximum: 2147483647 }),
  },
  { additionalProperties: false },
);
export const ReactionListSchema = Type.Object(
  { reactions: Type.Array(ReactionSummarySchema, { maxItems: 8 }) },
  { additionalProperties: false },
);
export type ReactionList = Static<typeof ReactionListSchema>;
export const ReactionOutcomeSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal('added'),
      Type.Literal('present'),
      Type.Literal('removed'),
      Type.Literal('absent'),
    ]),
  },
  { additionalProperties: false },
);
export type ReactionOutcome = Static<typeof ReactionOutcomeSchema>;
/**
 * One merged timeline row. Event and comment rows share optional fields —
 * events carry action/systemActor, comments carry moderation/deleted/body —
 * because a discriminated union cannot cross the runtime response
 * validation boundary on both profiles.
 */
export const TimelineItemSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal('event'), Type.Literal('comment')]),
    id: Type.String({ format: 'uuid' }),
    actorId: Type.Union([Type.Null(), Type.String({ format: 'uuid' })]),
    revision: Type.Integer({ minimum: 1 }),
    createdAt: Type.String(canonicalInstant),
    action: Type.Optional(Type.String({ minLength: 3, maxLength: 64 })),
    systemActor: Type.Optional(
      Type.Union([Type.Null(), Type.String({ maxLength: 64 })]),
    ),
    moderation: Type.Optional(CommentModerationSchema),
    deleted: Type.Optional(Type.Boolean()),
    ...ContentRepresentationFields,
    body: Type.Optional(Type.String({ maxLength: 32768 })),
  },
  { additionalProperties: false },
);
export const TimelinePageSchema = Type.Object(
  {
    items: Type.Array(TimelineItemSchema, { maxItems: 100 }),
    nextCursor: Type.Union([Type.Null(), Type.String({ maxLength: 1024 })]),
  },
  { additionalProperties: false },
);
export type TimelinePage = Static<typeof TimelinePageSchema>;
