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
    clientId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,128}$' }),
    redirectUri: Type.String({ minLength: 1, maxLength: 2048 }),
    scope: Type.String({ minLength: 1, maxLength: 256 }),
    state: Type.String({ minLength: 1, maxLength: 2048 }),
    codeChallenge: Type.String({
      pattern: '^[A-Za-z0-9_-]{43,128}$',
    }),
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
