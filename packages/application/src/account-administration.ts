/** Current principal state for authorization facts and staff administration. */
export interface PrincipalAccountFacts {
  readonly kind: 'user' | 'staff';
  readonly status: 'active' | 'suspended' | 'deleted';
  /** A current local-password credential still backs the principal. */
  readonly credentialActive: boolean;
  /**
   * The principal's most recent server-verified passkey user-verification
   * ceremony, or null when no passkey has been used. Only login ceremonies
   * advance this stamp; it is evidence, never a client claim.
   */
  readonly passkeyUsedAtMs: number | null;
}

/**
 * Project state as the authorization evaluator needs it, never raw rows.
 * The schema's project_status CHECK allows only these two states; a deleted
 * project is a missing row, not a third state.
 */
export interface ProjectVisibilityFacts {
  readonly visibility: 'public' | 'private';
  readonly state: 'active' | 'archived';
}

export interface AccountAdministrationStore {
  loadPrincipal(principalId: string): Promise<PrincipalAccountFacts | null>;
  loadProject(projectId: string): Promise<ProjectVisibilityFacts | null>;
  /**
   * The principal's newest unrevoked access-token issuance, or null when no
   * unrevoked token exists. Tokens are bounded to minutes, so behind a
   * verified bearer credential this is the freshest authorization instant.
   */
  tokenIssuedAtMs(principalId: string): Promise<number | null>;
  /** Suspend an existing, non-deleted principal; false when it cannot apply. */
  suspendPrincipal(principalId: string): Promise<boolean>;
  /** Restore a suspended principal; false when it cannot apply. */
  activatePrincipal(principalId: string): Promise<boolean>;
}
