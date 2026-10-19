import type { D1Database } from '@cloudflare/workers-types';
import { MINIMUM_ASYNC_LIMITS, AsyncError } from '@hyperbug/application';

export const validateMinimumReservation = (now: number, token: string) => {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(token)
  )
    throw new AsyncError('invalid');
};
export const minimumReservation = (
  db: D1Database,
  now: number,
  token: string | null,
) => {
  validateMinimumReservation(now, token ?? 'reserve');
  const day = Math.floor(now / 86400000),
    l = MINIMUM_ASYNC_LIMITS;
  return db
    .prepare(`INSERT INTO async_minimum_budget (id,day,reads,writes,reservation_token) VALUES (1,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET day=excluded.day,reservation_token=excluded.reservation_token,
      reads=CASE WHEN async_minimum_budget.day<excluded.day THEN excluded.reads ELSE async_minimum_budget.reads+excluded.reads END,
      writes=CASE WHEN async_minimum_budget.day<excluded.day THEN excluded.writes ELSE async_minimum_budget.writes+excluded.writes END
    WHERE async_minimum_budget.day<=excluded.day AND (async_minimum_budget.day<excluded.day OR
      (async_minimum_budget.reads+excluded.reads<=? AND async_minimum_budget.writes+excluded.writes<=?)) RETURNING id`)
    .bind(
      day,
      l.invocationReads,
      l.invocationWrites,
      token,
      l.dailyReads,
      l.dailyWrites,
    );
};
