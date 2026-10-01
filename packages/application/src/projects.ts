import { assertId, assertInstant } from '@hyperbug/domain';

/**
 * A project row (DATA-MODEL MVP records). The slug is the unique normalized
 * human-facing identifier; the status carries the archive-before-delete
 * retention direction — archived projects are read-only and physical deletion
 * belongs to the controlled retention workflow, not this surface.
 */
export interface ProjectRecord {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly visibility: 'public' | 'private';
  readonly status: 'active' | 'archived';
  readonly nextIssueNumber: number;
  readonly revision: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export function validateProjectRecord(record: ProjectRecord): void {
  assertId(record.id);
  if (!isValidProjectSlug(record.slug)) throw new Error('Invalid project slug');
  if (!isValidProjectName(record.name)) throw new Error('Invalid project name');
  if (record.visibility !== 'public' && record.visibility !== 'private')
    throw new Error('Invalid project visibility');
  if (record.status !== 'active' && record.status !== 'archived')
    throw new Error('Invalid project status');
  if (
    !Number.isSafeInteger(record.nextIssueNumber) ||
    record.nextIssueNumber < 1 ||
    record.nextIssueNumber > 2147483647
  )
    throw new Error('Invalid project number counter');
  if (
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1 ||
    record.revision > 2147483647
  )
    throw new Error('Invalid project revision');
  assertInstant(record.createdAtMs);
  assertInstant(record.updatedAtMs);
  if (record.updatedAtMs < record.createdAtMs)
    throw new Error('Invalid project timestamps');
}

/** Lowercase DNS-safe slugs only; no silent normalization of client input. */
export function isValidProjectSlug(slug: string): boolean {
  return (
    slug.length >= 1 &&
    slug.length <= 63 &&
    slug === slug.toLowerCase() &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)
  );
}

export function isValidProjectName(name: string): boolean {
  return (
    [...name].length >= 1 && [...name].length <= 100 && !name.includes('\0')
  );
}

export type ProjectCreateOutcome = 'created' | 'slug-conflict';

export interface ProjectCreateInput {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly visibility: 'public' | 'private';
  /**
   * The creating Staff principal receives the project's first administrator
   * role in the same atomic write, so a crash can never strand a project
   * without an administrator.
   */
  readonly administratorPrincipalId: string;
  readonly nowMs: number;
}

export type ProjectConfigureOutcome =
  | { readonly outcome: 'configured'; readonly record: ProjectRecord }
  | { readonly outcome: 'not-found' }
  | { readonly outcome: 'conflict' };

export interface ProjectConfigureInput {
  readonly id: string;
  readonly expectedRevision: number;
  readonly name: string | null;
  readonly visibility: 'public' | 'private' | null;
  readonly nowMs: number;
}

export type ProjectArchiveOutcome =
  | { readonly outcome: 'archived'; readonly record: ProjectRecord }
  | { readonly outcome: 'not-found' }
  | { readonly outcome: 'conflict' };

/**
 * Persistence port for projects. Writes are conditional on the observed
 * revision; outcomes distinguish not-found from concurrent-change conflicts
 * and never throw for expected results.
 */
export interface ProjectStore {
  /** Insert the project and its first administrator grant atomically. */
  create(input: ProjectCreateInput): Promise<ProjectCreateOutcome>;
  load(id: string): Promise<ProjectRecord | null>;
  loadBySlug(slug: string): Promise<ProjectRecord | null>;
  /** Conditionally update name/visibility at the observed revision. */
  configure(input: ProjectConfigureInput): Promise<ProjectConfigureOutcome>;
  /** Archive from the active state only; archived stays read-only. */
  archive(
    input: Omit<ProjectConfigureInput, 'name' | 'visibility'>,
  ): Promise<ProjectArchiveOutcome>;
}

/** The public project view the API returns; no internal counters leak. */
export interface ProjectView {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly visibility: 'public' | 'private';
  readonly status: 'active' | 'archived';
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function projectView(record: ProjectRecord): ProjectView {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    visibility: record.visibility,
    status: record.status,
    revision: record.revision,
    createdAt: new Date(record.createdAtMs).toISOString(),
    updatedAt: new Date(record.updatedAtMs).toISOString(),
  };
}
