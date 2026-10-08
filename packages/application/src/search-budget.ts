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
  return new SearchError(
    /(?:daily.*(?:limit|exceed)|quota|(?:read|write).*limit.*exceed)/iu.test(
      message,
    )
      ? 'SEARCH_BUDGET_EXHAUSTED'
      : 'SEARCH_UNAVAILABLE',
  );
}
