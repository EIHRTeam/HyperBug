import type { Pool } from 'pg';
import {
  validateProjectRecord,
  type ProjectArchiveOutcome,
  type ProjectConfigureInput,
  type ProjectConfigureOutcome,
  type ProjectCreateInput,
  type ProjectCreateOutcome,
  type ProjectRecord,
  type ProjectStore,
} from '@hyperbug/application';

interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  visibility: 'public' | 'private';
  status: 'active' | 'archived';
  next_issue_number: string | number;
  revision: string | number;
  created_at: string | number;
  updated_at: string | number;
}

function toRecord(row: ProjectRow): ProjectRecord {
  const record: ProjectRecord = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    visibility: row.visibility,
    status: row.status,
    nextIssueNumber: Number(row.next_issue_number),
    revision: Number(row.revision),
    createdAtMs: Number(row.created_at),
    updatedAtMs: Number(row.updated_at),
  };
  validateProjectRecord(record);
  return record;
}

const columns =
  'id, slug, name, visibility, status, next_issue_number, revision, created_at, updated_at';

/**
 * PostgreSQL adapter for projects, mirroring the D1 store. The create runs
 * in one transaction: the project insert and the creator's first
 * administrator grant commit together or not at all.
 */
export function createPostgresProjectStore(pool: Pool): ProjectStore {
  return {
    async create(input: ProjectCreateInput): Promise<ProjectCreateOutcome> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query(
          "INSERT INTO projects (id, slug, name, visibility, status, next_issue_number, revision, created_at, updated_at) VALUES ($1, $2, $3, $4, 'active', 1, 1, $5, $6) ON CONFLICT (slug) DO NOTHING RETURNING id",
          [
            input.id,
            input.slug,
            input.name,
            input.visibility,
            input.nowMs,
            input.nowMs,
          ],
        );
        if (inserted.rows.length === 0) {
          await client.query('ROLLBACK');
          return 'slug-conflict';
        }
        await client.query(
          "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at) VALUES ($1, $2, 'staff', 'administrator', $3)",
          [input.id, input.administratorPrincipalId, input.nowMs],
        );
        await client.query('COMMIT');
        return 'created';
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async load(id) {
      const { rows } = await pool.query<ProjectRow>(
        `SELECT ${columns} FROM projects WHERE id = $1 LIMIT 1`,
        [id],
      );
      return rows.length === 0 ? null : toRecord(rows[0]!);
    },
    async loadBySlug(slug) {
      const { rows } = await pool.query<ProjectRow>(
        `SELECT ${columns} FROM projects WHERE slug = $1 LIMIT 1`,
        [slug],
      );
      return rows.length === 0 ? null : toRecord(rows[0]!);
    },
    async configure(
      input: ProjectConfigureInput,
    ): Promise<ProjectConfigureOutcome> {
      const current = await pool
        .query<ProjectRow>(
          `SELECT ${columns} FROM projects WHERE id = $1 LIMIT 1`,
          [input.id],
        )
        .then((result) => result.rows[0] ?? null);
      if (current === null) return { outcome: 'not-found' };
      const { rows } = await pool.query<ProjectRow>(
        'UPDATE projects SET name = $1, visibility = $2, revision = revision + 1, updated_at = GREATEST(updated_at, $3) WHERE id = $4 AND revision = $5 RETURNING ' +
          columns,
        [
          input.name ?? current.name,
          input.visibility ?? current.visibility,
          input.nowMs,
          input.id,
          input.expectedRevision,
        ],
      );
      return rows.length === 0
        ? { outcome: 'conflict' }
        : { outcome: 'configured', record: toRecord(rows[0]!) };
    },
    async archive(
      input: Omit<ProjectConfigureInput, 'name' | 'visibility'>,
    ): Promise<ProjectArchiveOutcome> {
      const current = await pool
        .query<ProjectRow>(
          `SELECT ${columns} FROM projects WHERE id = $1 LIMIT 1`,
          [input.id],
        )
        .then((result) => result.rows[0] ?? null);
      if (current === null) return { outcome: 'not-found' };
      const { rows } = await pool.query<ProjectRow>(
        "UPDATE projects SET status = 'archived', revision = revision + 1, updated_at = GREATEST(updated_at, $1) WHERE id = $2 AND revision = $3 AND status = 'active' RETURNING " +
          columns,
        [input.nowMs, input.id, input.expectedRevision],
      );
      return rows.length === 0
        ? { outcome: 'conflict' }
        : { outcome: 'archived', record: toRecord(rows[0]!) };
    },
  };
}
