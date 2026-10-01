import type { D1Database } from '@cloudflare/workers-types';
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
  next_issue_number: number;
  revision: number;
  created_at: number;
  updated_at: number;
}

function toRecord(row: ProjectRow): ProjectRecord {
  const record: ProjectRecord = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    visibility: row.visibility,
    status: row.status,
    nextIssueNumber: row.next_issue_number,
    revision: row.revision,
    createdAtMs: row.created_at,
    updatedAtMs: row.updated_at,
  };
  validateProjectRecord(record);
  return record;
}

const columns =
  'id, slug, name, visibility, status, next_issue_number, revision, created_at, updated_at';

/**
 * D1 adapter for projects. The create is one atomic batch: the project
 * insert and the creator's first administrator grant commit together, so a
 * slug conflict rolls both back (the grant's foreign key fails when the
 * project row was not inserted) and a crash can never strand a project
 * without an administrator.
 */
export function createD1ProjectStore(db: D1Database): ProjectStore {
  return {
    async create(input: ProjectCreateInput): Promise<ProjectCreateOutcome> {
      try {
        await db.batch([
          db
            .prepare(
              "INSERT INTO projects (id, slug, name, visibility, status, next_issue_number, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 1, 1, ?, ?) ON CONFLICT (slug) DO NOTHING RETURNING id",
            )
            .bind(
              input.id,
              input.slug,
              input.name,
              input.visibility,
              input.nowMs,
              input.nowMs,
            ),
          db
            .prepare(
              "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at) VALUES (?, ?, 'staff', 'administrator', ?)",
            )
            .bind(input.id, input.administratorPrincipalId, input.nowMs),
        ]);
        return 'created';
      } catch (error) {
        // A slug conflict rolls the batch back with the slug left present;
        // any other failure must surface, never masquerade as success.
        const existing = await db
          .prepare('SELECT id FROM projects WHERE slug = ? LIMIT 1')
          .bind(input.slug)
          .first<{ id: string }>();
        if (existing === null) throw error;
        return 'slug-conflict';
      }
    },
    async load(id) {
      const row = await db
        .prepare(`SELECT ${columns} FROM projects WHERE id = ? LIMIT 1`)
        .bind(id)
        .first<ProjectRow>();
      return row === null ? null : toRecord(row);
    },
    async loadBySlug(slug) {
      const row = await db
        .prepare(`SELECT ${columns} FROM projects WHERE slug = ? LIMIT 1`)
        .bind(slug)
        .first<ProjectRow>();
      return row === null ? null : toRecord(row);
    },
    async configure(
      input: ProjectConfigureInput,
    ): Promise<ProjectConfigureOutcome> {
      const current = await db
        .prepare(`SELECT ${columns} FROM projects WHERE id = ? LIMIT 1`)
        .bind(input.id)
        .first<ProjectRow>();
      if (current === null) return { outcome: 'not-found' };
      const row = await db
        .prepare(
          'UPDATE projects SET name = ?, visibility = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING ' +
            columns,
        )
        .bind(
          input.name ?? current.name,
          input.visibility ?? current.visibility,
          Math.max(input.nowMs, current.updated_at),
          input.id,
          input.expectedRevision,
        )
        .first<ProjectRow>();
      return row === null
        ? { outcome: 'conflict' }
        : { outcome: 'configured', record: toRecord(row) };
    },
    async archive(
      input: Omit<ProjectConfigureInput, 'name' | 'visibility'>,
    ): Promise<ProjectArchiveOutcome> {
      const current = await db
        .prepare(`SELECT ${columns} FROM projects WHERE id = ? LIMIT 1`)
        .bind(input.id)
        .first<ProjectRow>();
      if (current === null) return { outcome: 'not-found' };
      const row = await db
        .prepare(
          "UPDATE projects SET status = 'archived', revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND status = 'active' RETURNING " +
            columns,
        )
        .bind(
          Math.max(input.nowMs, current.updated_at),
          input.id,
          input.expectedRevision,
        )
        .first<ProjectRow>();
      return row === null
        ? { outcome: 'conflict' }
        : { outcome: 'archived', record: toRecord(row) };
    },
  };
}
