export interface ProgressiveDelayPolicy {
  /** Delay after the first failed attempt. */
  readonly initialMs: number;
  /** Upper bound for a single delay. */
  readonly maximumMs: number;
  /** Number of failures at each delay level before doubling. */
  readonly failuresPerStep: number;
}

/** Pure policy for the optional minimum tier; persistence owns lockout state. */
export function progressiveAccountDelayMs(
  failedAttempts: number,
  policy: ProgressiveDelayPolicy,
): number {
  if (
    !Number.isSafeInteger(failedAttempts) ||
    failedAttempts < 0 ||
    failedAttempts > 2147483647 ||
    !Number.isSafeInteger(policy?.initialMs) ||
    policy.initialMs < 1 ||
    policy.initialMs > 86400000 ||
    !Number.isSafeInteger(policy.maximumMs) ||
    policy.maximumMs < policy.initialMs ||
    policy.maximumMs > 86400000 ||
    !Number.isSafeInteger(policy.failuresPerStep) ||
    policy.failuresPerStep < 1 ||
    policy.failuresPerStep > 100
  )
    throw new Error('Invalid progressive delay policy');
  if (failedAttempts === 0) return 0;
  let delay = policy.initialMs;
  let steps = Math.floor((failedAttempts - 1) / policy.failuresPerStep);
  while (steps > 0 && delay < policy.maximumMs) {
    delay = Math.min(delay * 2, policy.maximumMs);
    steps--;
  }
  return delay;
}
