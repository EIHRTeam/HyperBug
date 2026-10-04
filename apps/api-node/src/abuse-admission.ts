import { isAbsolute } from 'node:path';
import { Pool, type PoolConfig } from 'pg';
import type { RuntimeConfig } from '@hyperbug/config';
import {
  createPostgresAccountAdministration,
  createPostgresAccountRecoveryStore,
  createPostgresAccountRegistrationStore,
  createPostgresAccountSessionStore,
  createPostgresAuditRepository,
  createPostgresKeyRegistry,
  createPostgresOAuthStores,
  createPostgresPasskeyStores,
  createPostgresPluginRegistryStore,
  createPostgresPluginEventOutbox,
  createPostgresPluginSettingsStore,
  createPostgresProjectRoleStore,
  createPostgresProjectStore,
  createPostgresRateCounterStore,
  createPostgresRepository,
  createPostgresCommentStore,
  createPostgresReactionStore,
  createPostgresTimelineStore,
  createPostgresStaffEnrollmentStore,
  createPostgresTaxonomyStore,
  createPostgresContentDefinitionStore,
  createPostgresAttachmentStore,
  createPostgresUploadIntentStore,
} from '@hyperbug/database-postgres';
import type {
  AuditAppend,
  SensitiveAdmissionDependencies,
} from '@hyperbug/server';
import type { KeyProvider, KeyRegistry } from '@hyperbug/security';
import type {
  AccountAdministrationStore,
  AttachmentStore,
  AccountPasswordStore,
  AccountRecoveryStore,
  AccountRegistrationStore,
  AccountSessionStore,
  OAuthAccessTokenStore,
  OAuthCodeStore,
  PluginRegistryStore,
  PluginEventOutboxStore,
  PluginSettingsStore,
  ProjectRoleStore,
  ProjectStore,
  IssueRepository,
  CommentStore,
  ReactionStore,
  TimelineStore,
  StaffEnrollmentStore,
  TaxonomyStore,
  ContentDefinitionStore,
  UploadIntentStore,
} from '@hyperbug/application';
import { defaultUploadQuota } from '@hyperbug/application';
import { createNodeAbuseKeyProvider } from './abuse-keys.ts';
import { nodeSocketClientAddress } from './client-address.ts';
import { createNodeVolumetricLimiter } from './rate-limit.ts';
import { createNodeKeyProvider } from './key-provider.ts';
import { startNodeRateCounterCleanup } from './rate-cleanup.ts';

export interface NodeAbuseBindings {
  readonly databaseUrl?: unknown;
  readonly socketDirectory?: unknown;
  readonly databaseName?: unknown;
  readonly databaseUser?: unknown;
  readonly keyFile?: unknown;
  /** Optional cryptographic key source sharing this database's registry. */
  readonly keyProviderFile?: unknown;
}

export interface NodeAbuseAdmission {
  readonly abuse: SensitiveAdmissionDependencies | null;
  readonly keyRegistry: KeyRegistry | null;
  readonly keyProvider: KeyProvider | null;
  readonly registrationStore: AccountRegistrationStore | null;
  readonly passwordStore: AccountPasswordStore | null;
  readonly sessionStore: AccountSessionStore | null;
  readonly staffEnrollmentStore: StaffEnrollmentStore | null;
  readonly recoveryStore: AccountRecoveryStore | null;
  readonly oauthCodeStore: (OAuthCodeStore & OAuthAccessTokenStore) | null;
  readonly projectRoleStore: ProjectRoleStore | null;
  readonly projectStore: ProjectStore | null;
  readonly issueRepository: IssueRepository | null;
  readonly commentStore: CommentStore | null;
  readonly reactionStore: ReactionStore | null;
  readonly timelineStore: TimelineStore | null;
  readonly taxonomyStore: TaxonomyStore | null;
  readonly uploadIntentStore: UploadIntentStore | null;
  readonly contentDefinitionStore: ContentDefinitionStore | null;
  readonly attachmentStore: AttachmentStore | null;
  readonly pluginRegistryStore: PluginRegistryStore | null;
  readonly pluginSettingsStore: PluginSettingsStore | null;
  readonly pluginEventOutbox: PluginEventOutboxStore | null;
  readonly accountAdministration: AccountAdministrationStore | null;
  readonly passkeyStores:
    | (import('@hyperbug/application').PasskeyStore &
        import('@hyperbug/application').WebauthnChallengeStore)
    | null;
  /** Append-only audit sink sharing this database's pool. */
  readonly auditAppend: AuditAppend | null;
  /** Trusted maintenance call; the runtime also schedules it every five minutes. */
  purgeExpiredRateCounters(nowMs: number): Promise<number>;
  ready(signal: AbortSignal): Promise<boolean>;
  close(): Promise<void>;
}

/** One bounded pool serves optional key lifecycle and abuse admission. */
export function configureNodeAbuseAdmission(
  bindings: NodeAbuseBindings,
  environment: RuntimeConfig['environment'],
): NodeAbuseAdmission {
  const databaseUrl = bindings.databaseUrl;
  const socketDirectory = bindings.socketDirectory;
  const databaseName = bindings.databaseName;
  const databaseUser = bindings.databaseUser;
  const keyFile = bindings.keyFile;
  const keyProviderFile = bindings.keyProviderFile;
  const socketSelected =
    socketDirectory !== undefined ||
    databaseName !== undefined ||
    databaseUser !== undefined;
  if (
    databaseUrl === undefined &&
    !socketSelected &&
    keyFile === undefined &&
    keyProviderFile === undefined
  )
    return Object.freeze({
      abuse: null,
      keyRegistry: null,
      keyProvider: null,
      registrationStore: null,
      passwordStore: null,
      sessionStore: null,
      staffEnrollmentStore: null,
      recoveryStore: null,
      oauthCodeStore: null,
      projectRoleStore: null,
      projectStore: null,
      issueRepository: null,
      commentStore: null,
      reactionStore: null,
      timelineStore: null,
      taxonomyStore: null,
      contentDefinitionStore: null,
      attachmentStore: null,
      uploadIntentStore: null,
      pluginRegistryStore: null,
      pluginSettingsStore: null,
      pluginEventOutbox: null,
      accountAdministration: null,
      passkeyStores: null,
      auditAppend: null,
      purgeExpiredRateCounters: async () => {
        throw new Error('Rate counter cleanup unavailable');
      },
      ready: async () => false,
      close: async () => {},
    });
  if (
    (keyFile === undefined && keyProviderFile === undefined) ||
    (keyFile !== undefined && typeof keyFile !== 'string') ||
    (keyProviderFile !== undefined &&
      (typeof keyProviderFile !== 'string' ||
        !isAbsolute(keyProviderFile) ||
        keyProviderFile.includes('\0'))) ||
    (environment !== 'local' &&
      environment !== 'staging' &&
      environment !== 'production')
  )
    throw new Error('Invalid Node security database configuration');
  let connection: PoolConfig;
  if (databaseUrl !== undefined) {
    if (
      socketSelected ||
      typeof databaseUrl !== 'string' ||
      databaseUrl.length < 1 ||
      databaseUrl.length > 4096
    )
      throw new Error('Invalid Node security database configuration');
    let url: URL;
    try {
      url = new URL(databaseUrl);
    } catch {
      throw new Error('Invalid Node security database configuration');
    }
    if (
      (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
      !url.hostname ||
      url.pathname.length < 2 ||
      url.search ||
      url.hash ||
      (environment === 'local' &&
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
      throw new Error('Invalid Node security database configuration');
    // Reject URI options so pg cannot overwrite the explicit TLS mode.
    connection = {
      connectionString: databaseUrl,
      ssl: environment === 'local' ? false : { rejectUnauthorized: true },
    };
  } else {
    if (
      typeof socketDirectory !== 'string' ||
      socketDirectory.length < 1 ||
      socketDirectory.length > 4096 ||
      !isAbsolute(socketDirectory) ||
      socketDirectory.includes('\0') ||
      typeof databaseName !== 'string' ||
      !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(databaseName) ||
      typeof databaseUser !== 'string' ||
      !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(databaseUser)
    )
      throw new Error('Invalid Node security database configuration');
    // A local Unix socket has no network TLS segment.
    connection = {
      host: socketDirectory,
      database: databaseName,
      user: databaseUser,
      ssl: false,
    };
  }
  const provider =
    keyFile === undefined ? null : createNodeAbuseKeyProvider(keyFile);
  const pool = new Pool({
    ...connection,
    max: 4,
    connectionTimeoutMillis: 1000,
    idleTimeoutMillis: 10000,
    statement_timeout: 1000,
    query_timeout: 1500,
  });
  pool.on('error', () => {
    // Idle-client errors carry connection details; emit only a fixed message.
    console.error('PostgreSQL security connection unavailable');
  });
  const accountStore = createPostgresAccountRegistrationStore(pool);
  const rateStore = createPostgresRateCounterStore(pool);
  const cleanup = startNodeRateCounterCleanup(rateStore);
  const keyRegistry = createPostgresKeyRegistry(pool);
  const keyProvider =
    keyProviderFile === undefined
      ? null
      : createNodeKeyProvider(keyProviderFile, keyRegistry);
  const auditAppend = createPostgresAuditRepository(pool).append;
  return Object.freeze({
    abuse: provider
      ? Object.freeze({
          provider,
          store: rateStore,
          limiter: createNodeVolumetricLimiter({
            limit: 1000,
            windowMs: 60000,
            maxKeys: 10000,
          }),
          clientAddress: nodeSocketClientAddress,
          auditAppend,
        })
      : null,
    keyRegistry,
    keyProvider,
    registrationStore: accountStore,
    passwordStore: accountStore,
    sessionStore: createPostgresAccountSessionStore(pool),
    staffEnrollmentStore: createPostgresStaffEnrollmentStore(pool),
    recoveryStore: createPostgresAccountRecoveryStore(pool),
    oauthCodeStore: createPostgresOAuthStores(pool),
    projectRoleStore: createPostgresProjectRoleStore(pool),
    projectStore: createPostgresProjectStore(pool),
    issueRepository: createPostgresRepository(pool),
    commentStore: createPostgresCommentStore(pool),
    reactionStore: createPostgresReactionStore(pool),
    timelineStore: createPostgresTimelineStore(pool),
    taxonomyStore: createPostgresTaxonomyStore(pool),
    contentDefinitionStore: createPostgresContentDefinitionStore(pool),
    attachmentStore: createPostgresAttachmentStore(pool),
    uploadIntentStore: createPostgresUploadIntentStore(
      pool,
      defaultUploadQuota,
    ),
    pluginRegistryStore: createPostgresPluginRegistryStore(pool),
    pluginSettingsStore: createPostgresPluginSettingsStore(pool),
    pluginEventOutbox: createPostgresPluginEventOutbox(pool),
    accountAdministration: createPostgresAccountAdministration(pool),
    passkeyStores: createPostgresPasskeyStores(pool),
    auditAppend,
    purgeExpiredRateCounters: cleanup.run,
    async ready(signal: AbortSignal): Promise<boolean> {
      if (signal.aborted || !provider || !keyProvider) return false;
      try {
        await provider.active(signal);
        if (signal.aborted) return false;
        await keyProvider.current('token-hmac');
        if (signal.aborted) return false;
        await pool.query(
          'SELECT 1 FROM rate_limit_counters, password_credentials, authorization_sessions LIMIT 0',
        );
        return !signal.aborted;
      } catch {
        return false;
      }
    },
    close: async () => {
      await cleanup.close();
      await pool.end();
    },
  });
}
