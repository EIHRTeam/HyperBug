/** A deployment-scoped role fact; matches the security evaluator's shape. */
export interface InstanceRoleFacts {
  readonly principalId: string;
  readonly role: 'instance-administrator';
}
/** Current principal state for authorization facts and staff administration. */
export interface PrincipalAccountFacts {
  readonly kind: 'user' | 'staff';
  readonly status: 'active' | 'suspended' | 'deleted';
  /** A current local-password credential still backs the principal. */
  readonly credentialActive: boolean;
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

export interface InstanceRoleStore {
  /** Independent of project roles; project administration grants no instance powers. */
  loadInstanceRole(principalId: string): Promise<InstanceRoleFacts | null>;
}

export interface AccountAdministrationStore extends InstanceRoleStore {
  loadPrincipal(principalId: string): Promise<PrincipalAccountFacts | null>;
  loadProject(projectId: string): Promise<ProjectVisibilityFacts | null>;
  /** Suspend an existing, non-deleted principal; false when it cannot apply. */
  suspendPrincipal(principalId: string): Promise<boolean>;
  /** Restore a suspended principal; false when it cannot apply. */
  activatePrincipal(principalId: string): Promise<boolean>;
}
