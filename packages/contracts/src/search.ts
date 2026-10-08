/** Independently versioned public query contract; no database dialect types. */
export const SEARCH_AST_VERSION = 1 as const;
export const SEARCH_BOUNDS = Object.freeze({
  queryCodePoints: 512,
  queryBytes: 2048,
  valueCodePoints: 128,
  astDepth: 3,
  predicates: 16,
  orBranches: 4,
  negations: 8,
  labels: 8,
  sortFields: 1,
  ftsExpressionBytes: 4096,
  cursorBytes: 1024,
});
export const SEARCH_WINDOWS = Object.freeze({
  standard: Object.freeze({
    defaultLimit: 20,
    maximumLimit: 25,
    resultWindow: 200,
  }),
  'cloudflare-minimum': Object.freeze({
    defaultLimit: 10,
    maximumLimit: 10,
    resultWindow: 50,
  }),
});

export type SearchFilter =
  | 'state'
  | 'label'
  | 'assignee'
  | 'milestone'
  | 'type'
  | 'author'
  | 'project';
export type SearchPredicate =
  | {
      readonly kind: 'text';
      readonly value: string;
      readonly phrase: boolean;
      readonly negated: boolean;
    }
  | {
      readonly kind: 'filter';
      readonly field: SearchFilter;
      readonly value: string;
      readonly negated: boolean;
    };
/** OR of AND branches. Empty query has exactly one empty branch. */
export interface SearchAst {
  readonly version: typeof SEARCH_AST_VERSION;
  readonly branches: readonly (readonly SearchPredicate[])[];
  readonly sort: readonly ['created_desc'];
}
export type SearchQueryErrorCode =
  | 'SEARCH_SYNTAX'
  | 'SEARCH_UNSUPPORTED'
  | 'SEARCH_VALUE'
  | 'SEARCH_PRINCIPAL_REQUIRED'
  | 'SEARCH_COMPLEXITY'
  | 'SEARCH_VERSION';
export type SearchAvailabilityErrorCode =
  | 'SEARCH_UNAVAILABLE'
  | 'SEARCH_INDEX_INCOMPLETE'
  | 'SEARCH_BUDGET_EXHAUSTED'
  | 'SEARCH_WINDOW_EXHAUSTED';

export interface SearchSuggestions {
  readonly items: readonly {
    readonly field: SearchFilter;
    readonly value: string;
  }[];
}

/** Per-statement canonical candidate ceiling, separately fingerprinted from result windows. */
export const SEARCH_SCAN_LIMITS = Object.freeze({
  standard: 4096,
  'cloudflare-minimum': 256,
});
