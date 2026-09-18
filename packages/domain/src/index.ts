export type PrincipalKind = 'user' | 'staff';
export type IssueState = 'open' | 'closed';
export type CloseReason =
  'completed' | 'not_planned' | 'duplicate' | 'invalid' | 'cannot_reproduce';
export interface Issue {
  id: string;
  projectId: string;
  number: number;
  title: string;
  body: string;
  state: IssueState;
  closeReason: CloseReason | null;
  typeId: string | null;
  milestoneId: string | null;
  moderation: 'visible' | 'hidden' | 'redacted';
  deletedAt: number | null;
  authorId: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
}
export type IssueListItem = Omit<Issue, 'body'>;

export interface MutationResult {
  id: string;
  projectId: string;
  number: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
}
export type DomainErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'REVISION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_EXPIRED'
  | 'INVALID_CURSOR'
  | 'CURSOR_STALE';
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  constructor(code: DomainErrorCode) {
    super(code);
    this.code = code;
  }
}
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function assertId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !uuidPattern.test(value))
    throw new DomainError('INVALID_INPUT');
}
export function assertInstant(value: unknown): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 8640000000000000
  )
    throw new DomainError('INVALID_INPUT');
}
export function assertRevision(value: unknown): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value >= 2147483647
  )
    throw new DomainError('INVALID_INPUT');
}
export function validateContent(title: string, body: string) {
  if (
    typeof title !== 'string' ||
    title !== title.trim() ||
    [...title].length < 1 ||
    [...title].length > 200 ||
    typeof body !== 'string' ||
    [...body].length > 32768 ||
    title.includes('\0') ||
    body.includes('\0') ||
    new TextDecoder().decode(new TextEncoder().encode(title)) !== title ||
    new TextDecoder().decode(new TextEncoder().encode(body)) !== body
  )
    throw new DomainError('INVALID_INPUT');
}
export function mutationResult(issue: Issue): MutationResult {
  return {
    id: issue.id,
    projectId: issue.projectId,
    number: issue.number,
    revision: issue.revision,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}
