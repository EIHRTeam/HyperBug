import {
  SEARCH_AST_VERSION,
  SEARCH_BOUNDS,
  SEARCH_WINDOWS,
  SEARCH_SCAN_LIMITS,
  type SearchAst,
  type SearchPredicate,
  type SearchFilter,
  type SearchQueryErrorCode,
  type SearchAvailabilityErrorCode,
} from '@hyperbug/contracts';
import { assertId, assertInstant, type IssueListItem } from '@hyperbug/domain';
import type { IssuePage, IssueRelations } from './index.ts';
export { SEARCH_BOUNDS, SEARCH_WINDOWS } from '@hyperbug/contracts';
export type {
  SearchAst,
  SearchPredicate,
  SearchFilter,
} from '@hyperbug/contracts';

export class SearchError extends Error {
  readonly code:
    | SearchQueryErrorCode
    | SearchAvailabilityErrorCode
    | 'INVALID_CURSOR'
    | 'CURSOR_STALE';
  constructor(
    code:
      | SearchQueryErrorCode
      | SearchAvailabilityErrorCode
      | 'INVALID_CURSOR'
      | 'CURSOR_STALE',
  ) {
    super(code);
    this.code = code;
    this.name = 'SearchError';
  }
}
export const searchFields: readonly SearchFilter[] = [
  'state',
  'label',
  'assignee',
  'milestone',
  'type',
  'author',
  'project',
];
function fail(code: SearchQueryErrorCode): never {
  throw new SearchError(code);
}
const hasControl = (input: string) =>
  [...input].some(
    (char) => char.codePointAt(0)! < 32 || char.codePointAt(0) === 127,
  );
export const normalizeSearchText = (input: string) =>
  input.normalize('NFC').toLowerCase().normalize('NFC');
/** Internal tokenizer input, never a replacement for the canonical text projection. */
export const searchTokenText = (input: string) =>
  ` ${(normalizeSearchText(input).match(/[\p{L}\p{N}\p{M}]+/gu) ?? []).join(' ')} `;
const keys = (object: object, expected: string) =>
  Object.keys(object).sort().join(',') === expected;
const uuid = (value: string) => {
  try {
    assertId(value);
  } catch {
    fail('SEARCH_VALUE');
  }
};
function filterValue(
  field: SearchFilter,
  raw: string,
  principalId?: string,
): string {
  if (field === 'state') {
    const state = raw.toLowerCase();
    if (state !== 'open' && state !== 'closed') fail('SEARCH_VALUE');
    return state;
  }
  if ((field === 'assignee' || field === 'author') && raw === 'me') {
    if (!principalId) fail('SEARCH_PRINCIPAL_REQUIRED');
    uuid(principalId);
    return principalId;
  }
  uuid(raw);
  return raw;
}

/** Validates direct ASTs too, before traversal, fingerprinting or any persistence call. */
export function validateSearchAst(input: unknown): SearchAst {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    fail('SEARCH_SYNTAX');
  const root = input as Record<string, unknown>;
  if (root.version !== SEARCH_AST_VERSION) fail('SEARCH_VERSION');
  if (
    !keys(root, 'branches,sort,version') ||
    !Array.isArray(root.branches) ||
    !Array.isArray(root.sort)
  )
    fail('SEARCH_SYNTAX');
  if (
    root.branches.length > SEARCH_BOUNDS.orBranches ||
    root.sort.length > SEARCH_BOUNDS.sortFields
  )
    fail('SEARCH_COMPLEXITY');
  if (
    root.branches.length < 1 ||
    root.sort.length !== 1 ||
    root.sort[0] !== 'created_desc'
  )
    fail('SEARCH_UNSUPPORTED');
  let count = 0,
    negations = 0,
    labels = 0;
  const branches = root.branches.map((branch: unknown) => {
    if (!Array.isArray(branch)) fail('SEARCH_SYNTAX');
    count += branch.length;
    if (count > SEARCH_BOUNDS.predicates) fail('SEARCH_COMPLEXITY');
    if (
      !branch.length &&
      root.branches instanceof Array &&
      root.branches.length !== 1
    )
      fail('SEARCH_SYNTAX');
    return branch.map((raw: unknown): SearchPredicate => {
      if (Array.isArray(raw)) fail('SEARCH_COMPLEXITY');
      if (!raw || typeof raw !== 'object') fail('SEARCH_SYNTAX');
      const leaf = raw as Record<string, unknown>;
      if (typeof leaf.value !== 'string' || typeof leaf.negated !== 'boolean')
        fail('SEARCH_SYNTAX');
      if (
        leaf.value.length > SEARCH_BOUNDS.valueCodePoints * 2 ||
        [...leaf.value].length > SEARCH_BOUNDS.valueCodePoints
      )
        fail('SEARCH_COMPLEXITY');
      if (
        !leaf.value.length ||
        leaf.value !== leaf.value.normalize('NFC') ||
        hasControl(leaf.value)
      )
        fail('SEARCH_VALUE');
      if (leaf.negated && ++negations > SEARCH_BOUNDS.negations)
        fail('SEARCH_COMPLEXITY');
      if (leaf.kind === 'text') {
        if (
          !keys(leaf, 'kind,negated,phrase,value') ||
          typeof leaf.phrase !== 'boolean'
        )
          fail('SEARCH_SYNTAX');
        return {
          kind: 'text',
          value: leaf.value,
          phrase: leaf.phrase,
          negated: leaf.negated,
        };
      }
      if (leaf.kind !== 'filter' || !keys(leaf, 'field,kind,negated,value'))
        fail('SEARCH_SYNTAX');
      if (!searchFields.includes(leaf.field as SearchFilter))
        fail('SEARCH_UNSUPPORTED');
      const field = leaf.field as SearchFilter;
      if (field === 'label' && ++labels > SEARCH_BOUNDS.labels)
        fail('SEARCH_COMPLEXITY');
      if (filterValue(field, leaf.value) !== leaf.value) fail('SEARCH_VALUE');
      return {
        kind: 'filter',
        field,
        value: leaf.value,
        negated: leaf.negated,
      };
    });
  });
  return { version: SEARCH_AST_VERSION, branches, sort: ['created_desc'] };
}

export function parseSearchQuery(
  source: string,
  principalId?: string,
): SearchAst {
  if (typeof source !== 'string') fail('SEARCH_SYNTAX');
  if (
    source.length > SEARCH_BOUNDS.queryCodePoints * 2 ||
    [...source].length > SEARCH_BOUNDS.queryCodePoints ||
    new TextEncoder().encode(source).length > SEARCH_BOUNDS.queryBytes
  )
    fail('SEARCH_COMPLEXITY');
  if ([...source].some((char) => hasControl(char) && !/\s/u.test(char)))
    fail('SEARCH_SYNTAX');
  let position = 0;
  const branches: SearchPredicate[][] = [[]];
  const word = () => {
    const start = position;
    while (
      position < source.length &&
      !/\s/u.test(source[position]!) &&
      ![':', '"'].includes(source[position]!)
    )
      position++;
    return source.slice(start, position);
  };
  const quoted = () => {
    position++;
    let result = '';
    while (position < source.length) {
      const char = source[position++];
      if (char === '"') return result || fail('SEARCH_SYNTAX');
      if (char === '\\') {
        const escaped = source[position++];
        if (escaped !== '"' && escaped !== '\\') fail('SEARCH_SYNTAX');
        result += escaped;
      } else result += char;
    }
    return fail('SEARCH_SYNTAX');
  };
  while (position < source.length) {
    if (/\s/u.test(source[position]!)) {
      position++;
      continue;
    }
    const negated = source[position] === '-';
    if (negated) position++;
    if (
      position >= source.length ||
      /\s/u.test(source[position]!) ||
      source[position] === '-'
    )
      fail('SEARCH_SYNTAX');
    let phrase = source[position] === '"';
    let token = phrase ? quoted() : word();
    if (!phrase && token === 'OR' && !negated && source[position] !== ':') {
      if (!branches.at(-1)!.length) fail('SEARCH_SYNTAX');
      if (branches.length === SEARCH_BOUNDS.orBranches)
        fail('SEARCH_COMPLEXITY');
      branches.push([]);
      continue;
    }
    let field: SearchFilter | undefined;
    if (!phrase && source[position] === ':') {
      if (!searchFields.includes(token as SearchFilter))
        fail('SEARCH_UNSUPPORTED');
      field = token as SearchFilter;
      position++;
      phrase = source[position] === '"';
      token = phrase ? quoted() : word();
    }
    if (!token || (!phrase && token.startsWith('-'))) fail('SEARCH_SYNTAX');
    if (
      !phrase &&
      ['(', ')', '[', ']', '{', '}', '*', '|', '&', '~', '<', '>'].some(
        (mark) => token.includes(mark),
      )
    )
      fail('SEARCH_UNSUPPORTED');
    if (
      !phrase &&
      (token.includes('\\') || ['AND', 'NOT', 'NEAR'].includes(token))
    )
      fail('SEARCH_UNSUPPORTED');
    if (position < source.length && !/\s/u.test(source[position]!))
      fail('SEARCH_SYNTAX');
    token = token.normalize('NFC');
    if ([...token].length > SEARCH_BOUNDS.valueCodePoints)
      fail('SEARCH_COMPLEXITY');
    branches.at(-1)!.push(
      field
        ? {
            kind: 'filter',
            field,
            value: filterValue(field, token, principalId),
            negated,
          }
        : { kind: 'text', value: token, phrase, negated },
    );
    if (
      branches.reduce((n, branch) => n + branch.length, 0) >
      SEARCH_BOUNDS.predicates
    )
      fail('SEARCH_COMPLEXITY');
  }
  if (branches.length > 1 && !branches.at(-1)!.length) fail('SEARCH_SYNTAX');
  return validateSearchAst({
    version: SEARCH_AST_VERSION,
    branches,
    sort: ['created_desc'],
  });
}

export interface SearchQuery {
  projectId: string;
  ast: SearchAst;
  principalId?: string;
  tier?: keyof typeof SEARCH_WINDOWS;
  limit?: number;
  after?: string;
}
export interface SearchPage extends IssuePage {
  relations: IssueRelations;
}
export interface SearchStore {
  search(query: SearchQuery): Promise<SearchPage>;
}
interface SearchCursor {
  v: 1;
  resource: 'issues.search';
  policy: 1;
  project: string;
  filter: string;
  sort: 'created_desc';
  tier: keyof typeof SEARCH_WINDOWS;
  used: number;
  time: number;
  id: string;
}
export interface SearchPageOptions {
  ast: SearchAst;
  limit: number;
  window: number;
  fingerprint: string;
  tier: keyof typeof SEARCH_WINDOWS;
  cursor: SearchCursor | null;
}
export async function searchPageOptions(
  query: SearchQuery,
): Promise<SearchPageOptions> {
  uuid(query.projectId);
  if (query.principalId !== undefined) uuid(query.principalId);
  const ast = validateSearchAst(query.ast),
    tier = query.tier ?? 'standard';
  if (!(tier in SEARCH_WINDOWS)) fail('SEARCH_VALUE');
  const policy = SEARCH_WINDOWS[tier],
    limit = query.limit ?? policy.defaultLimit;
  if (!Number.isInteger(limit) || limit < 1 || limit > policy.maximumLimit)
    fail('SEARCH_VALUE');
  const canonical = JSON.stringify({
    ast: {
      ...ast,
      branches: ast.branches.map((branch) =>
        branch.map((leaf) =>
          leaf.kind === 'text'
            ? { ...leaf, value: normalizeSearchText(leaf.value) }
            : leaf,
        ),
      ),
    },
    tier,
    bounds: SEARCH_BOUNDS,
    scanLimit: SEARCH_SCAN_LIMITS[tier],
    tokenizer: 1,
    policy: 1,
  });
  const fingerprint = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(canonical),
      ),
    ),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
  let cursor: SearchCursor | null = null;
  if (query.after !== undefined) {
    try {
      if (
        !query.after.length ||
        query.after.length > SEARCH_BOUNDS.cursorBytes ||
        !/^[A-Za-z0-9_-]+$/u.test(query.after)
      )
        throw new Error();
      const raw = JSON.parse(
        atob(query.after.replaceAll('-', '+').replaceAll('_', '/')),
      ) as SearchCursor;
      if (raw && typeof raw === 'object' && 'v' in raw && raw.v !== 1)
        throw new SearchError('CURSOR_STALE');
      if (raw?.resource === 'issues.search' && raw.policy !== 1)
        throw new SearchError('CURSOR_STALE');
      if (
        !raw ||
        typeof raw !== 'object' ||
        !keys(raw, 'filter,id,policy,project,resource,sort,tier,time,used,v') ||
        raw.resource !== 'issues.search' ||
        raw.project !== query.projectId ||
        raw.filter !== fingerprint ||
        raw.sort !== 'created_desc' ||
        raw.tier !== tier ||
        !Number.isInteger(raw.used) ||
        raw.used < 1 ||
        raw.used > policy.resultWindow
      )
        throw new Error();
      assertId(raw.id);
      assertInstant(raw.time);
      cursor = raw;
    } catch (error) {
      if (error instanceof SearchError && error.code === 'CURSOR_STALE')
        throw error;
      throw new SearchError('INVALID_CURSOR');
    }
    if (cursor.used >= policy.resultWindow)
      throw new SearchError('SEARCH_WINDOW_EXHAUSTED');
  }
  return {
    ast,
    tier,
    limit: Math.min(limit, policy.resultWindow - (cursor?.used ?? 0)),
    window: policy.resultWindow,
    fingerprint,
    cursor,
  };
}
export function searchPage(
  query: SearchQuery,
  options: SearchPageOptions,
  rows: IssueListItem[],
): IssuePage {
  const items = rows.slice(0, options.limit),
    last = items.at(-1),
    used = (options.cursor?.used ?? 0) + items.length;
  if (!last || (rows.length <= options.limit && used < options.window))
    return { items, nextCursor: null };
  const cursor: SearchCursor = {
    v: 1,
    resource: 'issues.search',
    policy: 1,
    project: query.projectId,
    filter: options.fingerprint,
    sort: 'created_desc',
    tier: options.tier,
    used,
    time: last.createdAt,
    id: last.id,
  };
  return {
    items,
    nextCursor: btoa(JSON.stringify(cursor))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/u, ''),
  };
}
