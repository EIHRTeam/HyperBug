import { SearchError } from './search.ts';
/** Search's conservative allocation, leaving the rest of D1's daily quota to other work. */
export const SEARCH_MINIMUM_BUDGET = Object.freeze({
  dailyReads: 1_000_000,
  dailyWrites: 20_000,
  searchReads: 20_000,
  searchWrites: 8,
  indexReads: 2_000,
  indexWritesPerDocument: 512,
});
export interface SearchBudgetReservation {
  reads: number;
  writes: number;
  nowMs: number;
}
export interface SearchBudgetStore {
  reserve(input: SearchBudgetReservation): Promise<boolean>;
}
export function searchBudgetOptions(input: SearchBudgetReservation) {
  if (
    !Number.isSafeInteger(input.nowMs) ||
    input.nowMs < 0 ||
    input.nowMs > 8640000000000000 ||
    !Number.isSafeInteger(input.reads) ||
    input.reads < 1 ||
    input.reads > SEARCH_MINIMUM_BUDGET.dailyReads ||
    !Number.isSafeInteger(input.writes) ||
    input.writes < 1 ||
    input.writes > SEARCH_MINIMUM_BUDGET.dailyWrites
  )
    throw new SearchError('SEARCH_COMPLEXITY');
  return { ...input, day: Math.floor(input.nowMs / 86400000) };
}
/** Provider errors remain private; unavailable work never becomes an empty successful page. */
export function searchAvailability(error: unknown): SearchError {
  if (error instanceof SearchError) return error;
  const message = error instanceof Error ? error.message : '';
  // A fixed number of literal searches per line keeps provider input linear.
  // Match the former regex's ordering and non-dotAll line boundaries.
  const exhausted = message.split(/[\n\r\u2028\u2029]/u).some((line) => {
    const text = line.toLowerCase();
    if (text.includes('quota')) return true;
    const daily = text.indexOf('daily');
    if (
      daily !== -1 &&
      (text.indexOf('limit', daily + 5) !== -1 ||
        text.indexOf('exceed', daily + 5) !== -1)
    )
      return true;
    const read = text.indexOf('read'),
      write = text.indexOf('write');
    const start =
      read === -1
        ? write === -1
          ? -1
          : write + 5
        : write === -1
          ? read + 4
          : Math.min(read + 4, write + 5);
    if (start === -1) return false;
    const limit = text.indexOf('limit', start);
    return limit !== -1 && text.indexOf('exceed', limit + 5) !== -1;
  });
  return new SearchError(
    exhausted ? 'SEARCH_BUDGET_EXHAUSTED' : 'SEARCH_UNAVAILABLE',
  );
}
