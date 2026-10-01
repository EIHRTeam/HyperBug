import type { Pool } from 'pg';
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
  revision: string | number;
}

interface IssueTypeRow extends LabelRow {
  icon: string;
  position: string | number;
  enabled: string | number;
}

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  state: 'open' | 'closed';
  due_date: string | null;
  revision: string | number;
  created_at: string | number;
  updated_at: string | number;
}

function toLabel(row: LabelRow): LabelRecord {
  const record: LabelRecord = {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    nameKey: row.name_key,
    description: row.description,
    color: row.color,
    revision: Number(row.revision),
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
    position: Number(row.position),
    enabled: Number(row.enabled) === 1,
    revision: Number(row.revision),
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
    revision: Number(row.revision),
    createdAtMs: Number(row.created_at),
    updatedAtMs: Number(row.updated_at),
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
 * PostgreSQL adapter for the per-project taxonomy, mirroring the D1 store:
 * schema-level unique name keys, revision-conditional writes and
 * reference-checked removals.
 */
export function createPostgresTaxonomyStore(pool: Pool): TaxonomyStore {
  const loadLabel = async (projectId: string, id: string) =>
    pool
      .query<LabelRow>(
        `SELECT ${labelColumns} FROM labels WHERE project_id = $1 AND id = $2 LIMIT 1`,
        [projectId, id],
      )
      .then((result) => result.rows[0] ?? null);

  const loadType = async (projectId: string, id: string) =>
    pool
      .query<IssueTypeRow>(
        `SELECT ${typeColumns} FROM issue_types WHERE project_id = $1 AND id = $2 LIMIT 1`,
        [projectId, id],
      )
      .then((result) => result.rows[0] ?? null);

  const loadMilestone = async (projectId: string, id: string) =>
    pool
      .query<MilestoneRow>(
        `SELECT ${milestoneColumns} FROM milestones WHERE project_id = $1 AND id = $2 LIMIT 1`,
        [projectId, id],
      )
      .then((result) => result.rows[0] ?? null);

  const nameKeyTaken = async (
    table: 'labels' | 'issue_types',
    projectId: string,
    nameKey: string,
    exceptId: string,
  ): Promise<boolean> =>
    pool
      .query(
        `SELECT 1 FROM ${table} WHERE project_id = $1 AND name_key = $2 AND id != $3 LIMIT 1`,
        [projectId, nameKey, exceptId],
      )
      .then((result) => result.rows.length > 0);

  const referenced = async (
    table: 'issue_labels' | 'issues',
    column: 'label_id' | 'type_id' | 'milestone_id',
    projectId: string,
    id: string,
  ): Promise<boolean> =>
    pool
      .query(
        `SELECT 1 FROM ${table} WHERE project_id = $1 AND ${column} = $2 LIMIT 1`,
        [projectId, id],
      )
      .then((result) => result.rows.length > 0);

  const progressByMilestone = async (
    projectId: string,
  ): Promise<Map<string, { open: number; closed: number }>> => {
    const counts = await pool.query<{
      milestone_id: string;
      state: string;
      count: string | number;
    }>(
      'SELECT milestone_id, state, COUNT(*) AS count FROM issues WHERE project_id = $1 AND milestone_id IS NOT NULL AND deleted_at IS NULL GROUP BY milestone_id, state',
      [projectId],
    );
    const progress = new Map<string, { open: number; closed: number }>();
    for (const row of counts.rows) {
      const entry = progress.get(row.milestone_id) ?? { open: 0, closed: 0 };
      if (row.state === 'open') entry.open += Number(row.count);
      else entry.closed += Number(row.count);
      progress.set(row.milestone_id, entry);
    }
    return progress;
  };

  return {
    async createLabel(input: LabelCreateInput) {
      const { rows } = await pool.query(
        'INSERT INTO labels (id, project_id, name, name_key, description, color) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, name_key) DO NOTHING RETURNING id',
        [
          input.id,
          input.projectId,
          input.name,
          nameKeyOf(input.name),
          input.description,
          input.color,
        ],
      );
      return rows.length === 0 ? 'name-conflict' : 'created';
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
      const { rows } = await pool.query<LabelRow>(
        'UPDATE labels SET name = $1, name_key = $2, description = $3, color = $4, revision = revision + 1 WHERE project_id = $5 AND id = $6 AND revision = $7 RETURNING ' +
          labelColumns,
        [
          name,
          nameKey,
          input.description ?? current.description,
          input.color ?? current.color,
          input.projectId,
          input.id,
          input.expectedRevision,
        ],
      );
      return rows.length === 0
        ? { outcome: 'conflict' }
        : { outcome: 'written', record: toLabel(rows[0]!) };
    },
    async listLabels(projectId) {
      const { rows } = await pool.query<LabelRow>(
        `SELECT ${labelColumns} FROM labels WHERE project_id = $1 ORDER BY name_key LIMIT 500`,
        [projectId],
      );
      return rows.map(toLabel);
    },
    async deleteLabel(projectId, id) {
      if (await referenced('issue_labels', 'label_id', projectId, id))
        return 'referenced';
      const result = await pool.query(
        'DELETE FROM labels WHERE project_id = $1 AND id = $2',
        [projectId, id],
      );
      return result.rowCount === 1 ? 'deleted' : 'not-found';
    },

    async createIssueType(input) {
      const { rows } = await pool.query(
        'INSERT INTO issue_types (id, project_id, name, name_key, description, icon, color, position, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (project_id, name_key) DO NOTHING RETURNING id',
        [
          input.id,
          input.projectId,
          input.name,
          nameKeyOf(input.name),
          input.description,
          input.icon,
          input.color,
          input.position,
          input.enabled ? 1 : 0,
        ],
      );
      return rows.length === 0 ? 'name-conflict' : 'created';
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
      const { rows } = await pool.query<IssueTypeRow>(
        'UPDATE issue_types SET name = $1, name_key = $2, description = $3, icon = $4, color = $5, position = $6, enabled = $7, revision = revision + 1 WHERE project_id = $8 AND id = $9 AND revision = $10 RETURNING ' +
          typeColumns,
        [
          name,
          nameKey,
          input.description ?? current.description,
          input.icon ?? current.icon,
          input.color ?? current.color,
          input.position ?? Number(current.position),
          (input.enabled ?? Number(current.enabled) === 1) ? 1 : 0,
          input.projectId,
          input.id,
          input.expectedRevision,
        ],
      );
      return rows.length === 0
        ? { outcome: 'conflict' }
        : { outcome: 'written', record: toIssueType(rows[0]!) };
    },
    async listIssueTypes(projectId) {
      const { rows } = await pool.query<IssueTypeRow>(
        `SELECT ${typeColumns} FROM issue_types WHERE project_id = $1 ORDER BY position, id LIMIT 500`,
        [projectId],
      );
      return rows.map(toIssueType);
    },
    async deleteIssueType(projectId, id) {
      if (await referenced('issues', 'type_id', projectId, id))
        return 'referenced';
      const result = await pool.query(
        'DELETE FROM issue_types WHERE project_id = $1 AND id = $2',
        [projectId, id],
      );
      return result.rowCount === 1 ? 'deleted' : 'not-found';
    },

    async createMilestone(input) {
      await pool.query(
        "INSERT INTO milestones (id, project_id, title, description, state, due_date, revision, created_at, updated_at) VALUES ($1, $2, $3, $4, 'open', $5, 1, $6, $7)",
        [
          input.id,
          input.projectId,
          input.title,
          input.description,
          input.dueDate,
          input.nowMs,
          input.nowMs,
        ],
      );
      return 'created';
    },
    async updateMilestone(input) {
      const current = await loadMilestone(input.projectId, input.id);
      if (current === null) return { outcome: 'not-found' };
      const { rows } = await pool.query<MilestoneRow>(
        'UPDATE milestones SET title = $1, description = $2, state = $3, due_date = $4, revision = revision + 1, updated_at = GREATEST(updated_at, $5) WHERE project_id = $6 AND id = $7 AND revision = $8 RETURNING ' +
          milestoneColumns,
        [
          input.title ?? current.title,
          input.description ?? current.description,
          input.state ?? current.state,
          input.dueDate === undefined ? current.due_date : input.dueDate,
          input.nowMs,
          input.projectId,
          input.id,
          input.expectedRevision,
        ],
      );
      if (rows.length === 0) return { outcome: 'conflict' };
      const progress = (await progressByMilestone(input.projectId)).get(
        rows[0]!.id,
      ) ?? { open: 0, closed: 0 };
      return {
        outcome: 'written',
        record: {
          ...toMilestone(rows[0]!),
          progress: {
            openIssues: progress.open,
            closedIssues: progress.closed,
          },
        },
      };
    },
    async listMilestones(projectId) {
      const { rows } = await pool.query<MilestoneRow>(
        `SELECT ${milestoneColumns} FROM milestones WHERE project_id = $1 ORDER BY created_at, id LIMIT 200`,
        [projectId],
      );
      if (rows.length === 0) return [];
      const progress = await progressByMilestone(projectId);
      return rows.map((row) => {
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
      const result = await pool.query(
        'DELETE FROM milestones WHERE project_id = $1 AND id = $2',
        [projectId, id],
      );
      return result.rowCount === 1 ? 'deleted' : 'not-found';
    },
  };
}
