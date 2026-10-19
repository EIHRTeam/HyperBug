/** Primary-store maintenance. Each target deletes at most limit rows per cycle. */
export interface ExpiredCleanupStore {
  purgeExpired(
    nowMs: number,
    retentionMs: number,
    limit: number,
  ): Promise<number>;
}
export const expiredCleanupBatchSize = 25;
export function validateExpiredCleanup(
  nowMs: number,
  retentionMs: number,
  limit: number,
): void {
  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    nowMs > 8640000000000000 ||
    !Number.isSafeInteger(retentionMs) ||
    retentionMs < 0 ||
    retentionMs > 315360000000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 25
  )
    throw new Error('Invalid expired cleanup bounds');
}
