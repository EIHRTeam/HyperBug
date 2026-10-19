import {
  SEARCH_BOUNDS,
  type SearchAst,
  type SearchPredicate,
  type SearchQueryErrorCode,
} from '@hyperbug/contracts';

export const searchProjectId = '00000000-0000-4000-8000-000000000001';
export const searchPrincipalId = '00000000-0000-4000-8000-000000000002';
export const searchLabelId = '00000000-0000-4000-8000-000000000003';
const ast = (...branches: SearchPredicate[][]): SearchAst => ({
  version: 1,
  branches,
  sort: ['created_desc'],
});
const text = (
  value: string,
  phrase = false,
  negated = false,
): SearchPredicate => ({
  kind: 'text',
  value,
  phrase,
  negated,
});
const filter = (
  field: Extract<SearchPredicate, { kind: 'filter' }>['field'],
  value: string,
  negated = false,
): SearchPredicate => ({ kind: 'filter', field, value, negated });

/** Expected resolved ASTs, shared by parser and both store acceptance lanes in B2. */
export const searchAcceptedFixtures: readonly {
  name: string;
  query: string;
  principalId?: string;
  expected: SearchAst;
}[] = [
  { name: 'empty search', query: ' \t ', expected: ast([]) },
  {
    name: 'phrase and exclusions',
    query: `"startup failure" -label:${searchLabelId} state:OPEN`,
    expected: ast([
      text('startup failure', true),
      filter('label', searchLabelId, true),
      filter('state', 'open'),
    ]),
  },
  {
    name: 'escaped quote and backslash',
    query: '"say \\"hello\\" at C:\\\\work"',
    expected: ast([text('say "hello" at C:\\work', true)]),
  },
  {
    name: 'Unicode NFC and distinct diacritics',
    query: 'cafe\u0301 東京',
    expected: ast([text('café'), text('東京')]),
  },
  {
    name: 'OR and negation',
    query: 'crash -timeout OR "OR"',
    expected: ast(
      [text('crash'), text('timeout', false, true)],
      [text('OR', true)],
    ),
  },
  {
    name: 'negative only remains bounded',
    query: '-crash',
    expected: ast([text('crash', false, true)]),
  },
  {
    name: 'all project metadata filters',
    query: `project:${searchProjectId} assignee:me milestone:${searchLabelId} type:${searchLabelId} author:me`,
    principalId: searchPrincipalId,
    expected: ast([
      filter('project', searchProjectId),
      filter('assignee', searchPrincipalId),
      filter('milestone', searchLabelId),
      filter('type', searchLabelId),
      filter('author', searchPrincipalId),
    ]),
  },
  {
    name: 'nonexistent IDs are valid and yield empty store results',
    query:
      'author:ffffffff-ffff-4fff-8fff-ffffffffffff state:open state:closed',
    expected: ast([
      filter('author', 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
      filter('state', 'open'),
      filter('state', 'closed'),
    ]),
  },
  {
    name: 'SQL injection is literal text',
    query: '"\u0027); DROP TABLE issues; --"',
    expected: ast([text("'); DROP TABLE issues; --", true)]),
  },
  {
    name: 'database operators inside quotes are literal',
    query: '"NEAR(title body) & !foo:*"',
    expected: ast([text('NEAR(title body) & !foo:*', true)]),
  },
];

export const searchRejectedFixtures: readonly {
  name: string;
  query: string;
  expected: SearchQueryErrorCode;
}[] = [
  {
    name: 'missing principal',
    query: 'author:me',
    expected: 'SEARCH_PRINCIPAL_REQUIRED',
  },
  { name: 'unterminated quote', query: '"crash', expected: 'SEARCH_SYNTAX' },
  {
    name: 'unsupported escape',
    query: '"crash\\n"',
    expected: 'SEARCH_SYNTAX',
  },
  { name: 'empty OR branch', query: 'crash OR', expected: 'SEARCH_SYNTAX' },
  { name: 'missing value', query: 'state:', expected: 'SEARCH_SYNTAX' },
  { name: 'unknown filter', query: 'is:open', expected: 'SEARCH_UNSUPPORTED' },
  {
    name: 'database grammar',
    query: 'crash NEAR timeout',
    expected: 'SEARCH_UNSUPPORTED',
  },
  {
    name: 'recursive grouping',
    query: '(crash OR timeout)',
    expected: 'SEARCH_UNSUPPORTED',
  },
  { name: 'wildcard', query: 'crash*', expected: 'SEARCH_UNSUPPORTED' },
  { name: 'bad state', query: 'state:pending', expected: 'SEARCH_VALUE' },
  {
    name: 'identifier injection',
    query: 'label:"1 OR 1=1"',
    expected: 'SEARCH_VALUE',
  },
  {
    name: 'query code points',
    query: 'x'.repeat(SEARCH_BOUNDS.queryCodePoints + 1),
    expected: 'SEARCH_COMPLEXITY',
  },
  {
    name: 'value code points',
    query: 'x'.repeat(SEARCH_BOUNDS.valueCodePoints + 1),
    expected: 'SEARCH_COMPLEXITY',
  },
  {
    name: 'predicate count',
    query: Array.from({ length: SEARCH_BOUNDS.predicates + 1 }, () => 'x').join(
      ' ',
    ),
    expected: 'SEARCH_COMPLEXITY',
  },
  {
    name: 'OR branches',
    query: Array.from({ length: SEARCH_BOUNDS.orBranches + 1 }, () => 'x').join(
      ' OR ',
    ),
    expected: 'SEARCH_COMPLEXITY',
  },
  {
    name: 'negation count',
    query: Array.from({ length: SEARCH_BOUNDS.negations + 1 }, () => '-x').join(
      ' ',
    ),
    expected: 'SEARCH_COMPLEXITY',
  },
  {
    name: 'label count',
    query: Array.from(
      { length: SEARCH_BOUNDS.labels + 1 },
      () => `label:${searchLabelId}`,
    ).join(' '),
    expected: 'SEARCH_COMPLEXITY',
  },
];

/** Deterministic malformed/mixed Unicode inputs; no dependency on a database dialect. */
export function searchFuzzCorpus(): string[] {
  const alphabet = [
    'a',
    ' ',
    ':',
    '"',
    '\\',
    '-',
    '(',
    ')',
    '*',
    'OR',
    'é',
    '東',
    '\u0000',
  ];
  let seed = 8;
  return Array.from({ length: 256 }, (_, index) => {
    let query = '';
    for (let position = 0; position < index % 96; position++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      query += alphabet[seed % alphabet.length];
    }
    return query;
  });
}

/** Direct AST validation must reject unknown versions, structure, sorts and excess depth. */
export const searchInvalidAstFixtures: readonly unknown[] = [
  { version: 2, branches: [[]], sort: ['created_desc'] },
  { ...ast([]), unexpected: true },
  { ...ast([]), sort: ['created_desc', 'updated_desc'] },
  { ...ast([]), branches: [[[text('nested')]]] },
  {
    ...ast([]),
    branches: [
      [{ kind: 'filter', field: 'state', value: 'open', negated: 'false' }],
    ],
  },
];
