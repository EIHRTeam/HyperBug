import type { Pool, PoolClient } from 'pg';
import { assertId, assertRevision, DomainError } from '@hyperbug/domain';
import {
  ContentDefinitionError,
  maxProjectContentDefinitions,
  normalizeSavedForm,
  normalizeIssueFormDefinition,
  validateSavedTemplate,
  type ContentDefinitionKind,
  type ContentDefinitionStore,
  type ContentDefinitionSummary,
  type IssueFormRecord,
  type IssueTemplateRecord,
  type SaveIssueForm,
  type SaveIssueTemplate,
  resolvedIssueFormDefaults,
  nameKeyOf,
  type IssueFormDefinition,
} from '@hyperbug/application';

interface HeadRow {
  id: string;
  project_id: string;
  name: string;
  enabled: number;
  revision: number;
}
interface FormRow extends HeadRow {
  version: number;
  definition: unknown;
  created_at: string;
}
interface TemplateRow extends HeadRow {
  version: number;
  body: string;
  created_at: string;
}
const tableOf = (kind: ContentDefinitionKind) =>
  kind === 'form' ? 'issue_forms' : 'issue_templates';
const summary = (row: HeadRow): ContentDefinitionSummary => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  enabled: row.enabled === 1,
  revision: row.revision,
});

export function createPostgresContentDefinitionStore(
  pool: Pool,
): ContentDefinitionStore {
  const readForm = async (
    db: Pool | PoolClient,
    projectId: string,
    id: string,
    version?: number,
  ): Promise<IssueFormRecord | null> => {
    assertId(projectId);
    assertId(id);
    if (version !== undefined) assertRevision(version);
    const { rows } = await db.query<FormRow>(
      `SELECT h.id, h.project_id, h.name, h.enabled, h.revision, v.version, v.definition, v.created_at FROM issue_forms h JOIN issue_form_versions v ON v.project_id = h.project_id AND v.form_id = h.id AND v.version = ${version === undefined ? 'h.revision' : '$3'} WHERE h.project_id = $1 AND h.id = $2`,
      [projectId, id, ...(version === undefined ? [] : [version])],
    );
    const row = rows[0];
    if (!row) return null;
    const definition = normalizeIssueFormDefinition(
      row.definition,
      'canonical',
    );
    return {
      ...summary(row),
      name: definition.name,
      version: row.version,
      definition,
      createdAtMs: Number(row.created_at),
    };
  };
  const readTemplate = async (
    db: Pool | PoolClient,
    projectId: string,
    id: string,
    version?: number,
  ): Promise<IssueTemplateRecord | null> => {
    assertId(projectId);
    assertId(id);
    if (version !== undefined) assertRevision(version);
    const { rows } = await db.query<TemplateRow>(
      `SELECT h.id, h.project_id, v.name, h.enabled, h.revision, v.version, v.body, v.created_at FROM issue_templates h JOIN issue_template_versions v ON v.project_id = h.project_id AND v.template_id = h.id AND v.version = ${version === undefined ? 'h.revision' : '$3'} WHERE h.project_id = $1 AND h.id = $2`,
      [projectId, id, ...(version === undefined ? [] : [version])],
    );
    const row = rows[0];
    return row
      ? {
          ...summary(row),
          version: row.version,
          body: row.body,
          createdAtMs:
            Number(row.created_at) === 0 ? null : Number(row.created_at),
        }
      : null;
  };
  async function save(
    kind: ContentDefinitionKind,
    input: SaveIssueForm | SaveIssueTemplate,
  ): Promise<IssueFormRecord | IssueTemplateRecord> {
    const db = await pool.connect();
    const version = (input.expectedRevision ?? 0) + 1;
    assertRevision(version);
    const name = 'definition' in input ? input.definition.name : input.name;
    try {
      await db.query('BEGIN');
      // Serialize catalog capacity and cross-kind name claims within this
      // project; the same lock precedes a form-bearing issue creation.
      const project = await db.query<{ status: string }>(
        'SELECT status FROM projects WHERE id = $1 FOR UPDATE',
        [input.projectId],
      );
      if (project.rows[0]?.status !== 'active')
        throw new DomainError('NOT_FOUND');
      const { rows: heads } = await db.query<HeadRow>(
        `SELECT id, project_id, name, enabled, revision FROM ${tableOf(kind)} WHERE project_id = $1 AND id = $2`,
        [input.projectId, input.id],
      );
      const current = heads[0];
      if (input.expectedRevision !== null && !current)
        throw new DomainError('NOT_FOUND');
      if (
        current &&
        (input.expectedRevision === null ||
          current.revision !== input.expectedRevision)
      )
        throw new DomainError('REVISION_CONFLICT');
      const taken = await db.query(
        "SELECT 1 FROM (SELECT id, name, 'form' AS kind FROM issue_forms WHERE project_id = $1 UNION ALL SELECT id, name, 'template' AS kind FROM issue_templates WHERE project_id = $1) WHERE name = $2 AND NOT (id = $3 AND kind = $4) LIMIT 1",
        [input.projectId, name, input.id, kind],
      );
      if (taken.rowCount)
        throw new ContentDefinitionError('CONTENT_NAME_CONFLICT');
      if (input.expectedRevision === null) {
        const { rows } = await db.query<{ count: string }>(
          'SELECT (SELECT COUNT(*) FROM issue_forms WHERE project_id = $1) + (SELECT COUNT(*) FROM issue_templates WHERE project_id = $1) AS count',
          [input.projectId],
        );
        if (Number(rows[0]!.count) >= maxProjectContentDefinitions)
          throw new ContentDefinitionError('CONTENT_CATALOG_LIMIT');
        if (kind === 'form')
          await db.query(
            'INSERT INTO issue_forms (id, project_id, name, enabled) VALUES ($1, $2, $3, $4)',
            [input.id, input.projectId, name, Number(input.enabled)],
          );
        else
          await db.query(
            'INSERT INTO issue_templates (id, project_id, name, body, enabled) VALUES ($1, $2, $3, $4, $5)',
            [
              input.id,
              input.projectId,
              name,
              (input as SaveIssueTemplate).body,
              Number(input.enabled),
            ],
          );
      } else {
        if (kind === 'form')
          await db.query(
            'UPDATE issue_forms SET name = $1, enabled = $2, revision = $3 WHERE project_id = $4 AND id = $5',
            [name, Number(input.enabled), version, input.projectId, input.id],
          );
        else
          await db.query(
            'UPDATE issue_templates SET name = $1, body = $2, enabled = $3, revision = $4 WHERE project_id = $5 AND id = $6',
            [
              name,
              (input as SaveIssueTemplate).body,
              Number(input.enabled),
              version,
              input.projectId,
              input.id,
            ],
          );
      }
      if (kind === 'form')
        await db.query(
          'INSERT INTO issue_form_versions (project_id, form_id, version, schema_version, definition, created_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6)',
          [
            input.projectId,
            input.id,
            version,
            (input as SaveIssueForm).definition.schemaVersion,
            JSON.stringify((input as SaveIssueForm).definition),
            input.now,
          ],
        );
      else
        await db.query(
          'INSERT INTO issue_template_versions (project_id, template_id, version, name, body, enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            input.projectId,
            input.id,
            version,
            name,
            (input as SaveIssueTemplate).body,
            Number(input.enabled),
            input.now,
          ],
        );
      const record =
        kind === 'form'
          ? await readForm(db, input.projectId, input.id)
          : await readTemplate(db, input.projectId, input.id);
      if (!record) throw new Error('Committed definition missing');
      await db.query('COMMIT');
      return record;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  return {
    resolveFormDefaults: (projectId, definition) =>
      resolvePostgresIssueFormDefaults(pool, projectId, definition),
    async list(kind, projectId, includeDisabled) {
      assertId(projectId);
      const { rows } = await pool.query<HeadRow>(
        `SELECT id, project_id, name, enabled, revision FROM ${tableOf(kind)} WHERE project_id = $1 ${includeDisabled ? '' : 'AND enabled = 1'} ORDER BY name COLLATE "C", id LIMIT $2`,
        [projectId, maxProjectContentDefinitions + 1],
      );
      if (rows.length > maxProjectContentDefinitions)
        throw new Error('Catalog exceeds read bound');
      return rows.map(summary);
    },
    getForm: (projectId, id, version) => readForm(pool, projectId, id, version),
    getTemplate: (projectId, id, version) =>
      readTemplate(pool, projectId, id, version),
    saveForm: async (raw) =>
      save('form', normalizeSavedForm(raw)) as Promise<IssueFormRecord>,
    saveTemplate: async (input) => {
      validateSavedTemplate(input);
      return save('template', input) as Promise<IssueTemplateRecord>;
    },
  };
}

export async function resolvePostgresIssueFormDefaults(
  db: Pool | PoolClient,
  projectId: string,
  definition: IssueFormDefinition,
  lock = false,
) {
  assertId(projectId);
  const labels = definition.labels.length
    ? (
        await db.query<{ id: string; name_key: string }>(
          'SELECT id, name_key FROM labels WHERE project_id = $1 AND name_key = ANY($2::text[])' +
            (lock ? ' FOR SHARE' : ''),
          [projectId, definition.labels.map(nameKeyOf)],
        )
      ).rows
    : [];
  const assignees = definition.assignees.length
    ? (
        await db.query<{ id: string; handle: string }>(
          "SELECT p.id, i.subject AS handle FROM project_roles r JOIN principals p ON p.id = r.principal_id JOIN identities i ON i.principal_id = p.id WHERE r.project_id = $1 AND p.kind = 'staff' AND p.status = 'active' AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND i.subject = ANY($2::text[])" +
            (lock ? ' FOR SHARE OF r, p, i' : ''),
          [projectId, [...definition.assignees]],
        )
      ).rows
    : [];
  const types =
    definition.type === null
      ? []
      : (
          await db.query<{ id: string; name_key: string }>(
            'SELECT id, name_key FROM issue_types WHERE project_id = $1 AND name_key = $2 AND enabled = 1' +
              (lock ? ' FOR SHARE' : ''),
            [projectId, nameKeyOf(definition.type)],
          )
        ).rows;
  return resolvedIssueFormDefaults(definition, labels, assignees, types);
}
