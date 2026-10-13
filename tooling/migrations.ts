import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export interface Migration {
  name: string;
  statements: string[];
  checksum: string;
}
export async function migrationStatements(
  profile: 'd1' | 'postgres',
): Promise<Migration[]> {
  const directory = new URL(
    `../packages/database/${profile}/migrations/`,
    import.meta.url,
  );
  const journal: { entries: { idx: number; tag: string }[] } = JSON.parse(
    await readFile(new URL('meta/_journal.json', directory), 'utf8'),
  );
  return Promise.all(
    journal.entries.map(async ({ idx, tag }, position) => {
      if (idx !== position || !/^\d{4}_[a-z0-9_]+$/.test(tag))
        throw new Error('Invalid migration journal');
      const sql = await readFile(new URL(`${tag}.sql`, directory), 'utf8');
      return {
        name: tag,
        statements: sql
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter(Boolean),
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}
