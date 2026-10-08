import type { D1Database } from '@cloudflare/workers-types';
import {
  searchBudgetOptions,
  searchAvailability,
  type SearchBudgetStore,
} from '@hyperbug/application';
const sql = `INSERT INTO search_budget (id, day, reads, writes) VALUES (1, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET day = excluded.day,
   reads = CASE WHEN search_budget.day = excluded.day THEN search_budget.reads + excluded.reads ELSE excluded.reads END,
   writes = CASE WHEN search_budget.day = excluded.day THEN search_budget.writes + excluded.writes ELSE excluded.writes END
   WHERE search_budget.day < excluded.day OR (search_budget.day = excluded.day AND search_budget.reads + excluded.reads <= 1000000 AND search_budget.writes + excluded.writes <= 20000) RETURNING id`;
export function createD1SearchBudgetStore(db: D1Database): SearchBudgetStore {
  return {
    async reserve(input) {
      const { day } = searchBudgetOptions(input);
      try {
        const rows = (
          await db.prepare(sql).bind(day, input.reads, input.writes).all()
        ).results;
        return rows.length === 1;
      } catch (error) {
        throw searchAvailability(error);
      }
    },
  };
}
