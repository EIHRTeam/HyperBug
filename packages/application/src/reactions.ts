import { assertId, assertInstant } from '@hyperbug/domain';

/** The closed allowlist mirrors the schema's reaction_allowlist CHECK. */
export const reactionValues = [
  'thumbs_up',
  'thumbs_down',
  'laugh',
  'hooray',
  'confused',
  'heart',
  'rocket',
  'eyes',
] as const;
export type ReactionValue = (typeof reactionValues)[number];

export function isReactionValue(value: unknown): value is ReactionValue {
  return (
    typeof value === 'string' &&
    (reactionValues as readonly string[]).includes(value)
  );
}

export interface ReactionTarget {
  readonly projectId: string;
  readonly issueId?: string;
  readonly commentId?: string;
}

export interface ReactionAddInput extends ReactionTarget {
  readonly principalId: string;
  readonly reaction: ReactionValue;
  readonly nowMs: number;
}

/**
 * Persistence port for reactions. The schema's unique
 * actor/target/value constraint makes add and remove idempotent — 'present'
 * and 'absent' are successes, not conflicts — and counts always come from
 * bounded grouped queries, never per-row aggregation.
 */
export interface ReactionStore {
  add(input: ReactionAddInput): Promise<'added' | 'present'>;
  remove(
    input: ReactionTarget & { principalId: string; reaction: ReactionValue },
  ): Promise<'removed' | 'absent'>;
  /** Bounded grouped counts for one page of issues. */
  issueCounts(
    projectId: string,
    issueIds: readonly string[],
  ): Promise<
    ReadonlyMap<string, readonly { reaction: ReactionValue; count: number }[]>
  >;
  /** Bounded grouped counts for one page of comments. */
  commentCounts(
    projectId: string,
    commentIds: readonly string[],
  ): Promise<
    ReadonlyMap<string, readonly { reaction: ReactionValue; count: number }[]>
  >;
}

export function validateReactionInput(
  input:
    | ReactionAddInput
    | (ReactionTarget & { principalId: string; reaction: ReactionValue }),
): void {
  assertId(input.projectId);
  assertId(input.principalId);
  const targetsIssue = 'issueId' in input && input.issueId !== undefined;
  const targetsComment = 'commentId' in input && input.commentId !== undefined;
  if (targetsIssue === targetsComment)
    throw new Error('A reaction targets exactly one of issue or comment');
  if (targetsIssue) assertId(input.issueId as string);
  if (targetsComment) assertId(input.commentId as string);
  if (!isReactionValue(input.reaction))
    throw new Error('Invalid reaction value');
  if ('nowMs' in input) assertInstant(input.nowMs);
}

export interface ReactionSummary {
  readonly reaction: ReactionValue;
  readonly count: number;
}
