import { assertId, assertInstant } from '@hyperbug/domain';
import type { AccountPasswordRecord } from './account-registration.ts';

export interface StaffEnrollmentInput {
  principalId: string;
  identityId: string;
  /** Canonical, lower-case ASCII staff handle; never an email join. */
  handle: string;
  passwordRecord: AccountPasswordRecord;
  nowMs: number;
}

/**
 * `staff-active` means an active Staff administrator already exists, so the
 * one-time enrollment path is permanently closed until no active Staff
 * remains. `handle-taken` means the local-password identity is already used.
 */
export type StaffEnrollmentResult =
  | { status: 'enrolled'; principalId: string }
  | { status: 'staff-active' }
  | { status: 'handle-taken' };

export interface StaffEnrollmentStore {
  enrollStaff(input: StaffEnrollmentInput): Promise<StaffEnrollmentResult>;
  /** Readiness/reporting only; never an authorization decision by itself. */
  countActiveStaff(): Promise<number>;
}

export function validateStaffEnrollmentInput(
  input: StaffEnrollmentInput,
): void {
  assertId(input.principalId);
  assertId(input.identityId);
  assertInstant(input.nowMs);
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(input.handle))
    throw new Error('Invalid staff enrollment handle');
}
