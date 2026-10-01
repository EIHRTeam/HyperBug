import { assertId, assertInstant } from '@hyperbug/domain';

/**
 * Per-project taxonomy records (DATA-MODEL MVP records). Name keys are the
 * normalized uniqueness domain — two labels whose names differ only by case
 * or spacing conflict — while the display name keeps the author's spelling.
 */
export interface LabelRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly nameKey: string;
  readonly description: string;
  readonly color: string;
  readonly revision: number;
}

export interface IssueTypeRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly nameKey: string;
  readonly description: string;
  readonly icon: string;
  readonly color: string;
  readonly position: number;
  readonly enabled: boolean;
  readonly revision: number;
}

export interface MilestoneRecord {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly state: 'open' | 'closed';
  readonly dueDate: string | null;
  readonly revision: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

/** Bounded derived counts; never a per-issue query per milestone row. */
export interface MilestoneProgress {
  readonly openIssues: number;
  readonly closedIssues: number;
}

export interface MilestoneView extends MilestoneRecord {
  readonly progress: MilestoneProgress;
}

export function nameKeyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export function isValidTaxonomyName(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length >= 1 &&
    [...name].length <= 100 &&
    !name.includes('\0') &&
    nameKeyOf(name).length >= 1 &&
    nameKeyOf(name).length <= 200
  );
}

export function isValidDescription(description: string): boolean {
  return [...description].length <= 4096 && !description.includes('\0');
}

export function isValidColor(color: string): boolean {
  return color === '' || /^#[0-9a-f]{6}$/.test(color);
}

export function isValidIcon(icon: string): boolean {
  return [...icon].length <= 100 && !icon.includes('\0');
}

export function isValidTitle(title: string): boolean {
  const trimmed = title.trim();
  return (
    trimmed.length >= 1 && [...title].length <= 200 && !title.includes('\0')
  );
}

/** Calendar dates only, stored as YYYY-MM-DD text in both dialects. */
export function isValidDueDate(dueDate: string | null): boolean {
  if (dueDate === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;
  const parsed = new Date(`${dueDate}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === dueDate
  );
}

function assertRevisionValue(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 1 || revision > 2147483647)
    throw new Error('Invalid taxonomy revision');
}

export function validateLabelRecord(record: LabelRecord): void {
  assertId(record.id);
  assertId(record.projectId);
  if (
    !isValidTaxonomyName(record.name) ||
    record.nameKey !== nameKeyOf(record.name)
  )
    throw new Error('Invalid label name');
  if (!isValidDescription(record.description))
    throw new Error('Invalid label description');
  if (!isValidColor(record.color)) throw new Error('Invalid label color');
  assertRevisionValue(record.revision);
}

export function validateIssueTypeRecord(record: IssueTypeRecord): void {
  assertId(record.id);
  assertId(record.projectId);
  if (
    !isValidTaxonomyName(record.name) ||
    record.nameKey !== nameKeyOf(record.name)
  )
    throw new Error('Invalid issue type name');
  if (!isValidDescription(record.description))
    throw new Error('Invalid issue type description');
  if (!isValidIcon(record.icon)) throw new Error('Invalid issue type icon');
  if (!isValidColor(record.color)) throw new Error('Invalid issue type color');
  if (
    !Number.isSafeInteger(record.position) ||
    record.position < 0 ||
    record.position > 2147483647
  )
    throw new Error('Invalid issue type position');
  if (typeof record.enabled !== 'boolean')
    throw new Error('Invalid issue type flag');
  assertRevisionValue(record.revision);
}

export function validateMilestoneRecord(record: MilestoneRecord): void {
  assertId(record.id);
  assertId(record.projectId);
  if (!isValidTitle(record.title)) throw new Error('Invalid milestone title');
  if (
    [...record.description].length > 32768 ||
    record.description.includes('\0')
  )
    throw new Error('Invalid milestone description');
  if (record.state !== 'open' && record.state !== 'closed')
    throw new Error('Invalid milestone state');
  if (!isValidDueDate(record.dueDate))
    throw new Error('Invalid milestone due date');
  assertRevisionValue(record.revision);
  assertInstant(record.createdAtMs);
  assertInstant(record.updatedAtMs);
  if (record.updatedAtMs < record.createdAtMs)
    throw new Error('Invalid milestone timestamps');
}

export interface TaxonomyWritten<T> {
  readonly outcome: 'written';
  readonly record: T;
}
export interface TaxonomyNotFound {
  readonly outcome: 'not-found';
}
export interface TaxonomyConflict {
  readonly outcome: 'conflict';
}
export interface TaxonomyNameConflict {
  readonly outcome: 'name-conflict';
}

export interface LabelCreateInput {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description: string;
  readonly color: string;
}

export interface LabelUpdateInput {
  readonly id: string;
  readonly projectId: string;
  readonly expectedRevision: number;
  readonly name: string | null;
  readonly description: string | null;
  readonly color: string | null;
}

/**
 * Per-project label, issue-type and milestone persistence. All writes are
 * project-scoped and conditional on the observed revision; a removal is
 * refused while any issue still references the entry (reference ownership —
 * the composite foreign keys make cross-project references impossible, and
 * the application refuses dangling in-project references instead of
 * cascading). Disabled issue types stay referenceable by existing issues but
 * are not selectable for new assignments.
 */
export interface TaxonomyStore {
  createLabel(input: LabelCreateInput): Promise<'created' | 'name-conflict'>;
  updateLabel(
    input: LabelUpdateInput,
  ): Promise<
    | TaxonomyWritten<LabelRecord>
    | TaxonomyNotFound
    | TaxonomyConflict
    | TaxonomyNameConflict
  >;
  listLabels(projectId: string): Promise<readonly LabelRecord[]>;
  /** False when absent; 'referenced' when issues still carry the label. */
  deleteLabel(
    projectId: string,
    id: string,
  ): Promise<'deleted' | 'not-found' | 'referenced'>;

  createIssueType(
    input: Omit<LabelCreateInput, 'description' | 'color'> & {
      readonly description: string;
      readonly icon: string;
      readonly color: string;
      readonly position: number;
      readonly enabled: boolean;
    },
  ): Promise<'created' | 'name-conflict'>;
  updateIssueType(
    input: Omit<LabelUpdateInput, 'description' | 'color'> & {
      readonly description: string | null;
      readonly icon: string | null;
      readonly color: string | null;
      readonly enabled: boolean | null;
      readonly position: number | null;
    },
  ): Promise<
    | TaxonomyWritten<IssueTypeRecord>
    | TaxonomyNotFound
    | TaxonomyConflict
    | TaxonomyNameConflict
  >;
  listIssueTypes(projectId: string): Promise<readonly IssueTypeRecord[]>;
  deleteIssueType(
    projectId: string,
    id: string,
  ): Promise<'deleted' | 'not-found' | 'referenced'>;

  createMilestone(input: {
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
    readonly description: string;
    readonly dueDate: string | null;
    readonly nowMs: number;
  }): Promise<'created'>;
  updateMilestone(input: {
    readonly id: string;
    readonly projectId: string;
    readonly expectedRevision: number;
    readonly title: string | null;
    readonly description: string | null;
    readonly dueDate: string | null | undefined;
    readonly state: 'open' | 'closed' | null;
    readonly nowMs: number;
  }): Promise<
    TaxonomyWritten<MilestoneView> | TaxonomyNotFound | TaxonomyConflict
  >;
  /** Bounded listing with derived progress counts from one grouped query. */
  listMilestones(projectId: string): Promise<readonly MilestoneView[]>;
  deleteMilestone(
    projectId: string,
    id: string,
  ): Promise<'deleted' | 'not-found' | 'referenced'>;
}

/** The API views mirror the records plus derived milestone progress. */
export function labelView(record: LabelRecord) {
  return {
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    description: record.description,
    color: record.color,
    revision: record.revision,
  };
}

export function issueTypeView(record: IssueTypeRecord) {
  return {
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    description: record.description,
    icon: record.icon,
    color: record.color,
    position: record.position,
    enabled: record.enabled,
    revision: record.revision,
  };
}

export function milestoneView(record: MilestoneView) {
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    description: record.description,
    state: record.state,
    dueDate: record.dueDate,
    revision: record.revision,
    createdAt: new Date(record.createdAtMs).toISOString(),
    updatedAt: new Date(record.updatedAtMs).toISOString(),
    progress: {
      open: record.progress.openIssues,
      closed: record.progress.closedIssues,
    },
  };
}
