import type { D1Database } from '@cloudflare/workers-types';
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
  definition: string;
  created_at: number;
}
interface TemplateRow extends HeadRow {
  version: number;
  body: string;
  created_at: number;
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

export function createD1ContentDefinitionStore(
  db: D1Database,
): ContentDefinitionStore {
  const head = (kind: ContentDefinitionKind, projectId: string, id: string) =>
    db
      .prepare(
        `SELECT id, project_id, name, enabled, revision FROM ${tableOf(kind)} WHERE project_id = ? AND id = ?`,
      )
      .bind(projectId, id)
      .first<HeadRow>();
  const count = async (projectId: string) =>
    (await db
      .prepare(
        'SELECT (SELECT COUNT(*) FROM issue_forms WHERE project_id = ?) + (SELECT COUNT(*) FROM issue_templates WHERE project_id = ?) AS count',
      )
      .bind(projectId, projectId)
      .first<{ count: number }>())!.count;
  const nameTaken = async (
    kind: ContentDefinitionKind,
    projectId: string,
    id: string,
    name: string,
  ) =>
    (await db
      .prepare(
        "SELECT 1 FROM (SELECT id, name, 'form' AS kind FROM issue_forms WHERE project_id = ? UNION ALL SELECT id, name, 'template' AS kind FROM issue_templates WHERE project_id = ?) WHERE name = ? AND NOT (id = ? AND kind = ?) LIMIT 1",
      )
      .bind(projectId, projectId, name, id, kind)
      .first()) !== null;
  const conditions = `EXISTS (SELECT 1 FROM projects WHERE id = ? AND status = 'active') AND NOT EXISTS (SELECT 1 FROM (SELECT id, name, 'form' AS kind FROM issue_forms WHERE project_id = ? UNION ALL SELECT id, name, 'template' AS kind FROM issue_templates WHERE project_id = ?) WHERE name = ? AND NOT (id = ? AND kind = ?))`;
  async function classify(
    kind: ContentDefinitionKind,
    input: SaveIssueForm | SaveIssueTemplate,
    name: string,
  ): Promise<never> {
    const project = await db
      .prepare('SELECT status FROM projects WHERE id = ?')
      .bind(input.projectId)
      .first<{ status: string }>();
    if (project?.status !== 'active') throw new DomainError('NOT_FOUND');
    const current = await head(kind, input.projectId, input.id);
    if (input.expectedRevision !== null && current === null)
      throw new DomainError('NOT_FOUND');
    if (
      current &&
      (input.expectedRevision === null ||
        current.revision !== input.expectedRevision)
    )
      throw new DomainError('REVISION_CONFLICT');
    if (await nameTaken(kind, input.projectId, input.id, name))
      throw new ContentDefinitionError('CONTENT_NAME_CONFLICT');
    if (
      input.expectedRevision === null &&
      (await count(input.projectId)) >= maxProjectContentDefinitions
    )
      throw new ContentDefinitionError('CONTENT_CATALOG_LIMIT');
    throw new Error('Content definition write failed');
  }
  async function save(
    kind: ContentDefinitionKind,
    input: SaveIssueForm | SaveIssueTemplate,
  ): Promise<void> {
    const name = 'definition' in input ? input.definition.name : input.name;
    const version = (input.expectedRevision ?? 0) + 1;
    assertRevision(version);
    const guards = [
      input.projectId,
      input.projectId,
      input.projectId,
      name,
      input.id,
      kind,
    ];
    const statements = [];
    if (input.expectedRevision === null) {
      const limit =
        '(SELECT COUNT(*) FROM issue_forms WHERE project_id = ?) + (SELECT COUNT(*) FROM issue_templates WHERE project_id = ?) < ?';
      statements.push(
        kind === 'form'
          ? db
              .prepare(
                `INSERT INTO issue_forms (id, project_id, name, enabled) SELECT ?, ?, ?, ? WHERE ${conditions} AND ${limit} RETURNING id`,
              )
              .bind(
                input.id,
                input.projectId,
                name,
                Number(input.enabled),
                ...guards,
                input.projectId,
                input.projectId,
                maxProjectContentDefinitions,
              )
          : db
              .prepare(
                `INSERT INTO issue_templates (id, project_id, name, body, enabled) SELECT ?, ?, ?, ?, ? WHERE ${conditions} AND ${limit} RETURNING id`,
              )
              .bind(
                input.id,
                input.projectId,
                name,
                (input as SaveIssueTemplate).body,
                Number(input.enabled),
                ...guards,
                input.projectId,
                input.projectId,
                maxProjectContentDefinitions,
              ),
      );
    } else {
      statements.push(
        kind === 'form'
          ? db
              .prepare(
                `UPDATE issue_forms SET name = ?, enabled = ?, revision = revision + 1 WHERE project_id = ? AND id = ? AND revision = ? AND ${conditions} RETURNING id`,
              )
              .bind(
                name,
                Number(input.enabled),
                input.projectId,
                input.id,
                input.expectedRevision,
                ...guards,
              )
          : db
              .prepare(
                `UPDATE issue_templates SET name = ?, body = ?, enabled = ?, revision = revision + 1 WHERE project_id = ? AND id = ? AND revision = ? AND ${conditions} RETURNING id`,
              )
              .bind(
                name,
                (input as SaveIssueTemplate).body,
                Number(input.enabled),
                input.projectId,
                input.id,
                input.expectedRevision,
                ...guards,
              ),
      );
    }
    // A zero-row conditional head write must abort the entire batch, even if
    // a legacy head is missing its snapshot. NULL violates the version NOT
    // NULL constraint; changes() refers to the preceding head statement.
    statements.push(
      kind === 'form'
        ? db
            .prepare(
              'INSERT INTO issue_form_versions (project_id, form_id, version, schema_version, definition, created_at) VALUES (?, ?, CASE WHEN changes() = 1 THEN ? ELSE NULL END, ?, ?, ?)',
            )
            .bind(
              input.projectId,
              input.id,
              version,
              (input as SaveIssueForm).definition.schemaVersion,
              JSON.stringify((input as SaveIssueForm).definition),
              input.now,
            )
        : db
            .prepare(
              'INSERT INTO issue_template_versions (project_id, template_id, version, name, body, enabled, created_at) VALUES (?, ?, CASE WHEN changes() = 1 THEN ? ELSE NULL END, ?, ?, ?, ?)',
            )
            .bind(
              input.projectId,
              input.id,
              version,
              name,
              (input as SaveIssueTemplate).body,
              Number(input.enabled),
              input.now,
            ),
    );
    let written: boolean;
    try {
      written = (await db.batch(statements))[0]!.results.length === 1;
    } catch {
      return classify(kind, input, name);
    }
    if (!written) await classify(kind, input, name);
  }
  const store: ContentDefinitionStore = {
    async resolveFormDefaults(projectId, definition) {
      assertId(projectId);
      // Name/handle sets bind as one JSON array so the bind count stays fixed.
      const nameSet = 'SELECT value FROM json_each(?)';
      const labels = definition.labels.length
        ? (
            await db
              .prepare(
                `SELECT id, name_key FROM labels WHERE project_id = ? AND name_key IN (${nameSet})`,
              )
              .bind(projectId, JSON.stringify(definition.labels.map(nameKeyOf)))
              .all<{ id: string; name_key: string }>()
          ).results
        : [];
      const assignees = definition.assignees.length
        ? (
            await db
              .prepare(
                `SELECT p.id, i.subject AS handle FROM project_roles r JOIN principals p ON p.id = r.principal_id JOIN identities i ON i.principal_id = p.id WHERE r.project_id = ? AND p.kind = 'staff' AND p.status = 'active' AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND i.subject IN (${nameSet})`,
              )
              .bind(projectId, JSON.stringify(definition.assignees))
              .all<{ id: string; handle: string }>()
          ).results
        : [];
      const types =
        definition.type === null
          ? []
          : (
              await db
                .prepare(
                  'SELECT id, name_key FROM issue_types WHERE project_id = ? AND name_key = ? AND enabled = 1',
                )
                .bind(projectId, nameKeyOf(definition.type))
                .all<{ id: string; name_key: string }>()
            ).results;
      return resolvedIssueFormDefaults(definition, labels, assignees, types);
    },
    async list(kind, projectId, includeDisabled) {
      assertId(projectId);
      const rows = (
        await db
          .prepare(
            `SELECT id, project_id, name, enabled, revision FROM ${tableOf(kind)} WHERE project_id = ? ${includeDisabled ? '' : 'AND enabled = 1'} ORDER BY name, id LIMIT ?`,
          )
          .bind(projectId, maxProjectContentDefinitions + 1)
          .all<HeadRow>()
      ).results;
      if (rows.length > maxProjectContentDefinitions)
        throw new Error('Catalog exceeds read bound');
      return rows.map(summary);
    },
    async getForm(projectId, id, version) {
      assertId(projectId);
      assertId(id);
      if (version !== undefined) assertRevision(version);
      const row = await db
        .prepare(
          `SELECT h.id, h.project_id, h.name, h.enabled, h.revision, v.version, v.definition, v.created_at FROM issue_forms h JOIN issue_form_versions v ON v.project_id = h.project_id AND v.form_id = h.id AND v.version = ${version === undefined ? 'h.revision' : '?'} WHERE h.project_id = ? AND h.id = ?`,
        )
        .bind(...(version === undefined ? [] : [version]), projectId, id)
        .first<FormRow>();
      if (!row) return null;
      const definition = normalizeIssueFormDefinition(
        JSON.parse(row.definition),
        'canonical',
      );
      return {
        ...summary(row),
        name: definition.name,
        version: row.version,
        definition,
        createdAtMs: row.created_at,
      } satisfies IssueFormRecord;
    },
    async getTemplate(projectId, id, version) {
      assertId(projectId);
      assertId(id);
      if (version !== undefined) assertRevision(version);
      const row = await db
        .prepare(
          `SELECT h.id, h.project_id, v.name, h.enabled, h.revision, v.version, v.body, v.created_at FROM issue_templates h JOIN issue_template_versions v ON v.project_id = h.project_id AND v.template_id = h.id AND v.version = ${version === undefined ? 'h.revision' : '?'} WHERE h.project_id = ? AND h.id = ?`,
        )
        .bind(...(version === undefined ? [] : [version]), projectId, id)
        .first<TemplateRow>();
      return row
        ? ({
            ...summary(row),
            version: row.version,
            body: row.body,
            createdAtMs: row.created_at === 0 ? null : row.created_at,
          } satisfies IssueTemplateRecord)
        : null;
    },
    async saveForm(raw) {
      const input = normalizeSavedForm(raw);
      await save('form', input);
      const record = await store.getForm(
        input.projectId,
        input.id,
        (input.expectedRevision ?? 0) + 1,
      );
      if (!record) throw new Error('Committed definition missing');
      return {
        ...record,
        revision: (input.expectedRevision ?? 0) + 1,
        enabled: input.enabled,
      };
    },
    async saveTemplate(input) {
      validateSavedTemplate(input);
      await save('template', input);
      const record = await store.getTemplate(
        input.projectId,
        input.id,
        (input.expectedRevision ?? 0) + 1,
      );
      if (!record) throw new Error('Committed definition missing');
      return {
        ...record,
        revision: (input.expectedRevision ?? 0) + 1,
        enabled: input.enabled,
      };
    },
  };
  return store;
}
