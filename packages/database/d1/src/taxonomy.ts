import type { D1Database } from '@cloudflare/workers-types';
import {
  nameKeyOf,
  validateIssueTypeRecord,
  validateLabelRecord,
  validateMilestoneRecord,
  type IssueTypeRecord,
  type LabelCreateInput,
  type LabelRecord,
  type LabelUpdateInput,
  type MilestoneRecord,
  type MilestoneView,
  type TaxonomyStore,
} from '@hyperbug/application';

interface LabelRow {
  id: string;
  project_id: string;
  name: string;
  name_key: string;
  description: string;
  color: string;
  revision: number;
}

interface IssueTypeRow extends LabelRow {
  icon: string;
  position: number;
  enabled: number;
}

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  state: 'open' | 'closed';
  due_date: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
}

function toLabel(row: LabelRow): LabelRecord {
  const record: LabelRecord = {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    nameKey: row.name_key,
    description: row.description,
    color: row.color,
    revision: row.revision,
  };
  validateLabelRecord(record);
  return record;
}

function toIssueType(row: IssueTypeRow): IssueTypeRecord {
  const record: IssueTypeRecord = {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    nameKey: row.name_key,
    description: row.description,
    icon: row.icon,
    color: row.color,
    position: row.position,
    enabled: row.enabled === 1,
    revision: row.revision,
  };
  validateIssueTypeRecord(record);
  return record;
}

function toMilestone(row: MilestoneRow): MilestoneRecord {
  const record: MilestoneRecord = {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    state: row.state,
    dueDate: row.due_date,
    revision: row.revision,
    createdAtMs: row.created_at,
    updatedAtMs: row.updated_at,
  };
  validateMilestoneRecord(record);
  return record;
}

const labelColumns =
  'id, project_id, name, name_key, description, color, revision';
const typeColumns = `${labelColumns}, icon, position, enabled`;
const milestoneColumns =
  'id, project_id, title, description, state, due_date, revision, created_at, updated_at';

/**
 * D1 adapter for the per-project taxonomy. Unique name keys are enforced by
 * the schema's unique constraints; removals are refused while any issue
 * still references the entry, so in-project references never dangle.
 */
export function createD1TaxonomyStore(db: D1Database): TaxonomyStore {
  const loadLabel = async (projectId: string, id: string) =>
    db
      .prepare(
        `SELECT ${labelColumns} FROM labels WHERE project_id = ? AND id = ? LIMIT 1`,
      )
      .bind(projectId, id)
      .first<LabelRow>();

  const loadType = async (projectId: string, id: string) =>
    db
      .prepare(
        `SELECT ${typeColumns} FROM issue_types WHERE project_id = ? AND id = ? LIMIT 1`,
      )
      .bind(projectId, id)
      .first<IssueTypeRow>();

  const loadMilestone = async (projectId: string, id: string) =>
    db
      .prepare(
        `SELECT ${milestoneColumns} FROM milestones WHERE project_id = ? AND id = ? LIMIT 1`,
      )
      .bind(projectId, id)
      .first<MilestoneRow>();

  const nameKeyTaken = async (
    table: 'labels' | 'issue_types',
    projectId: string,
    nameKey: string,
    exceptId: string,
  ): Promise<boolean> => {
    const row = await db
      .prepare(
        `SELECT id FROM ${table} WHERE project_id = ? AND name_key = ? AND id != ? LIMIT 1`,
      )
      .bind(projectId, nameKey, exceptId)
      .first<{ id: string }>();
    return row !== null;
  };

  const referenced = async (
    table: 'issue_labels' | 'issues',
    column: 'label_id' | 'type_id' | 'milestone_id',
    projectId: string,
    id: string,
  ): Promise<boolean> => {
    const row = await db
      .prepare(
        `SELECT 1 FROM ${table} WHERE project_id = ? AND ${column} = ? LIMIT 1`,
      )
      .bind(projectId, id)
      .first();
    return row !== null;
  };

  const progressByMilestone = async (
    projectId: string,
  ): Promise<Map<string, { open: number; closed: number }>> => {
    const counts = await db
      .prepare(
        'SELECT milestone_id AS milestone_id, state AS state, COUNT(*) AS count FROM issues WHERE project_id = ? AND milestone_id IS NOT NULL AND deleted_at IS NULL GROUP BY milestone_id, state',
      )
      .bind(projectId)
      .all<{ milestone_id: string; state: string; count: number }>();
    const progress = new Map<string, { open: number; closed: number }>();
    for (const row of counts.results) {
      const entry = progress.get(row.milestone_id) ?? { open: 0, closed: 0 };
      if (row.state === 'open') entry.open += row.count;
      else entry.closed += row.count;
      progress.set(row.milestone_id, entry);
    }
    return progress;
  };

  return {
    async createLabel(input: LabelCreateInput) {
      const row = await db
        .prepare(
          'INSERT INTO labels (id, project_id, name, name_key, description, color) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (project_id, name_key) DO NOTHING RETURNING id',
        )
        .bind(
          input.id,
          input.projectId,
          input.name,
          nameKeyOf(input.name),
          input.description,
          input.color,
        )
        .first<{ id: string }>();
      return row === null ? 'name-conflict' : 'created';
    },
    async updateLabel(input: LabelUpdateInput) {
      const current = await loadLabel(input.projectId, input.id);
      if (current === null) return { outcome: 'not-found' };
      const name = input.name ?? current.name;
      const nameKey = nameKeyOf(name);
      if (
        nameKey !== current.name_key &&
        (await nameKeyTaken('labels', input.projectId, nameKey, input.id))
      )
        return { outcome: 'name-conflict' };
      const row = await db
        .prepare(
          'UPDATE labels SET name = ?, name_key = ?, description = ?, color = ?, revision = revision + 1 WHERE project_id = ? AND id = ? AND revision = ? RETURNING ' +
            labelColumns,
        )
        .bind(
          name,
          nameKey,
          input.description ?? current.description,
          input.color ?? current.color,
          input.projectId,
          input.id,
          input.expectedRevision,
        )
        .first<LabelRow>();
      return row === null
        ? { outcome: 'conflict' }
        : { outcome: 'written', record: toLabel(row) };
    },
    async listLabels(projectId) {
      const rows = await db
        .prepare(
          `SELECT ${labelColumns} FROM labels WHERE project_id = ? ORDER BY name_key LIMIT 500`,
        )
        .bind(projectId)
        .all<LabelRow>();
      return rows.results.map(toLabel);
    },
    async deleteLabel(projectId, id) {
      if (await referenced('issue_labels', 'label_id', projectId, id))
        return 'referenced';
      const result = await db
        .prepare('DELETE FROM labels WHERE project_id = ? AND id = ?')
        .bind(projectId, id)
        .run();
      if (!Number.isSafeInteger(result.meta.changes) || result.meta.changes > 1)
        throw new Error('Invalid label deletion');
      return result.meta.changes === 1 ? 'deleted' : 'not-found';
    },

    async createIssueType(input) {
      const row = await db
        .prepare(
          'INSERT INTO issue_types (id, project_id, name, name_key, description, icon, color, position, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (project_id, name_key) DO NOTHING RETURNING id',
        )
        .bind(
          input.id,
          input.projectId,
          input.name,
          nameKeyOf(input.name),
          input.description,
          input.icon,
          input.color,
          input.position,
          input.enabled ? 1 : 0,
        )
        .first<{ id: string }>();
      return row === null ? 'name-conflict' : 'created';
    },
    async updateIssueType(input) {
      const current = await loadType(input.projectId, input.id);
      if (current === null) return { outcome: 'not-found' };
      const name = input.name ?? current.name;
      const nameKey = nameKeyOf(name);
      if (
        nameKey !== current.name_key &&
        (await nameKeyTaken('issue_types', input.projectId, nameKey, input.id))
      )
        return { outcome: 'name-conflict' };
      const row = await db
        .prepare(
          'UPDATE issue_types SET name = ?, name_key = ?, description = ?, icon = ?, color = ?, position = ?, enabled = ?, revision = revision + 1 WHERE project_id = ? AND id = ? AND revision = ? RETURNING ' +
            typeColumns,
        )
        .bind(
          name,
          nameKey,
          input.description ?? current.description,
          input.icon ?? current.icon,
          input.color ?? current.color,
          input.position ?? current.position,
          (input.enabled ?? current.enabled) ? 1 : 0,
          input.projectId,
          input.id,
          input.expectedRevision,
        )
        .first<IssueTypeRow>();
      return row === null
        ? { outcome: 'conflict' }
        : { outcome: 'written', record: toIssueType(row) };
    },
    async listIssueTypes(projectId) {
      const rows = await db
        .prepare(
          `SELECT ${typeColumns} FROM issue_types WHERE project_id = ? ORDER BY position, id LIMIT 500`,
        )
        .bind(projectId)
        .all<IssueTypeRow>();
      return rows.results.map(toIssueType);
    },
    async deleteIssueType(projectId, id) {
      if (await referenced('issues', 'type_id', projectId, id))
        return 'referenced';
      const result = await db
        .prepare('DELETE FROM issue_types WHERE project_id = ? AND id = ?')
        .bind(projectId, id)
        .run();
      if (!Number.isSafeInteger(result.meta.changes) || result.meta.changes > 1)
        throw new Error('Invalid issue type deletion');
      return result.meta.changes === 1 ? 'deleted' : 'not-found';
    },

    async createMilestone(input) {
      await db
        .prepare(
          "INSERT INTO milestones (id, project_id, title, description, state, due_date, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, 1, ?, ?)",
        )
        .bind(
          input.id,
          input.projectId,
          input.title,
          input.description,
          input.dueDate,
          input.nowMs,
          input.nowMs,
        )
        .run();
      return 'created';
    },
    async updateMilestone(input) {
      const current = await loadMilestone(input.projectId, input.id);
      if (current === null) return { outcome: 'not-found' };
      const row = await db
        .prepare(
          'UPDATE milestones SET title = ?, description = ?, state = ?, due_date = ?, revision = revision + 1, updated_at = ? WHERE project_id = ? AND id = ? AND revision = ? RETURNING ' +
            milestoneColumns,
        )
        .bind(
          input.title ?? current.title,
          input.description ?? current.description,
          input.state ?? current.state,
          input.dueDate === undefined ? current.due_date : input.dueDate,
          Math.max(input.nowMs, current.updated_at),
          input.projectId,
          input.id,
          input.expectedRevision,
        )
        .first<MilestoneRow>();
      if (row === null) return { outcome: 'conflict' };
      const progress = (await progressByMilestone(input.projectId)).get(
        row.id,
      ) ?? { open: 0, closed: 0 };
      return {
        outcome: 'written',
        record: {
          ...toMilestone(row),
          progress: {
            openIssues: progress.open,
            closedIssues: progress.closed,
          },
        },
      };
    },
    async listMilestones(projectId) {
      const rows = await db
        .prepare(
          `SELECT ${milestoneColumns} FROM milestones WHERE project_id = ? ORDER BY created_at, id LIMIT 200`,
        )
        .bind(projectId)
        .all<MilestoneRow>();
      if (rows.results.length === 0) return [];
      const progress = await progressByMilestone(projectId);
      return rows.results.map((row) => {
        const record = toMilestone(row);
        const countsForId = progress.get(record.id) ?? { open: 0, closed: 0 };
        const view: MilestoneView = {
          ...record,
          progress: {
            openIssues: countsForId.open,
            closedIssues: countsForId.closed,
          },
        };
        return view;
      });
    },
    async deleteMilestone(projectId, id) {
      if (await referenced('issues', 'milestone_id', projectId, id))
        return 'referenced';
      const result = await db
        .prepare('DELETE FROM milestones WHERE project_id = ? AND id = ?')
        .bind(projectId, id)
        .run();
      if (!Number.isSafeInteger(result.meta.changes) || result.meta.changes > 1)
        throw new Error('Invalid milestone deletion');
      return result.meta.changes === 1 ? 'deleted' : 'not-found';
    },
  };
}
