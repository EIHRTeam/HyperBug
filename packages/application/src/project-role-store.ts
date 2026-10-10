import type { PreparedAuditEvent } from './prepared-audit.ts';
import { assertId, assertInstant } from '@hyperbug/domain';

/**
 * The closed staff role set for project membership. These literals mirror the
 * security package's `StaffRole` and the database's `project_role_name`
 * CHECK; application cannot import the security package, and identical
 * literal unions stay assignable in both directions at the boundary.
 */
export type ProjectStaffRole = 'triage' | 'maintainer' | 'administrator';

export const projectStaffRoles: readonly ProjectStaffRole[] = [
  'triage',
  'maintainer',
  'administrator',
];

export function isProjectStaffRole(value: unknown): value is ProjectStaffRole {
  return (
    typeof value === 'string' &&
    (projectStaffRoles as readonly string[]).includes(value)
  );
}

export interface ProjectRoleGrant {
  readonly projectId: string;
  readonly principalId: string;
  readonly role: ProjectStaffRole;
  readonly nowMs: number;
}

export type ProjectRoleGrantOutcome = 'granted' | 'replaced';

export interface ProjectRoleStore {
  /**
   * Upsert the staff membership on the composite project+principal key.
   * 'granted' creates the row; 'replaced' overwrites an existing role.
   */
  grant(
    input: ProjectRoleGrant,
    audit: PreparedAuditEvent,
  ): Promise<ProjectRoleGrantOutcome>;
  /** Remove the membership; false when the principal held no role. */
  revoke(
    projectId: string,
    principalId: string,
    audit: PreparedAuditEvent,
  ): Promise<boolean>;
  /** The current role row; null when the principal is not a member. */
  loadRole(
    projectId: string,
    principalId: string,
  ): Promise<{ role: ProjectStaffRole } | null>;
  /**
   * Active projects where the principal holds an administrator role,
   * bounded and deterministic; anchors deployment-level staff
   * administration while the permission inventory has no deployment scope.
   */
  listAdministratorProjectIds(principalId: string): Promise<readonly string[]>;
}

export function validateProjectRoleGrant(input: ProjectRoleGrant): void {
  assertId(input.projectId);
  assertId(input.principalId);
  assertInstant(input.nowMs);
  if (!isProjectStaffRole(input.role)) throw new Error('Invalid project role');
}
