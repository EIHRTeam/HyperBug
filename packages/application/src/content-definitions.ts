import {
  assertId,
  assertInstant,
  assertRevision,
  validateContent,
} from '@hyperbug/domain';
import {
  IssueFormError,
  normalizeIssueFormDefinition,
  type IssueFormDefinition,
} from './issue-forms.ts';
import { nameKeyOf } from './taxonomy.ts';

export const maxProjectContentDefinitions = 64;
export type ContentDefinitionKind = 'form' | 'template';
export class ContentDefinitionError extends Error {
  readonly code: 'CONTENT_NAME_CONFLICT' | 'CONTENT_CATALOG_LIMIT';
  constructor(code: ContentDefinitionError['code']) {
    super(code);
    this.code = code;
  }
}
export interface ContentDefinitionSummary {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly revision: number;
}
export interface IssueFormRecord extends ContentDefinitionSummary {
  readonly version: number;
  readonly definition: IssueFormDefinition;
  readonly createdAtMs: number;
}
export interface IssueTemplateRecord extends ContentDefinitionSummary {
  readonly version: number;
  readonly body: string;
  readonly createdAtMs: number | null;
}
interface SaveDefinitionIdentity {
  readonly id: string;
  readonly projectId: string;
  /** null creates a new head; every update is conditional. */
  readonly expectedRevision: number | null;
  readonly enabled: boolean;
  readonly now: number;
}
export interface SaveIssueForm extends SaveDefinitionIdentity {
  readonly definition: IssueFormDefinition;
}
export interface SaveIssueTemplate extends SaveDefinitionIdentity {
  readonly name: string;
  readonly body: string;
}
export interface ContentDefinitionStore {
  /** At most the project catalog bound, summaries only, no Markdown/schema parsing. */
  list(
    kind: ContentDefinitionKind,
    projectId: string,
    includeDisabled: boolean,
  ): Promise<readonly ContentDefinitionSummary[]>;
  getForm(
    projectId: string,
    id: string,
    version?: number,
  ): Promise<IssueFormRecord | null>;
  getTemplate(
    projectId: string,
    id: string,
    version?: number,
  ): Promise<IssueTemplateRecord | null>;
  /** Head and immutable version commit together; names shared across both kinds. */
  saveForm(input: SaveIssueForm): Promise<IssueFormRecord>;
  saveTemplate(input: SaveIssueTemplate): Promise<IssueTemplateRecord>;
  /** Resolve authored defaults through current project-local taxonomy and Staff handles. */
  resolveFormDefaults(
    projectId: string,
    definition: IssueFormDefinition,
  ): Promise<IssueFormDefaults>;
}
export interface IssueFormDefaults {
  readonly labelIds: readonly string[];
  readonly assigneeIds: readonly string[];
  readonly typeId: string | null;
}
export function resolvedIssueFormDefaults(
  definition: IssueFormDefinition,
  labels: readonly { id: string; name_key: string }[],
  assignees: readonly { id: string; handle: string }[],
  types: readonly { id: string; name_key: string }[],
): IssueFormDefaults {
  const match = (
    names: readonly string[],
    rows: readonly { id: string; key: string }[],
    normalize: (v: string) => string,
  ) =>
    names.map((name) => {
      const matches = rows.filter((row) => row.key === normalize(name));
      if (matches.length !== 1)
        throw new IssueFormError('FORM_DEFAULTS_INVALID', 'defaults');
      return matches[0]!.id;
    });
  const labelIds = match(
    definition.labels,
    labels.map((row) => ({ id: row.id, key: row.name_key })),
    nameKeyOf,
  );
  const assigneeIds = match(
    definition.assignees,
    assignees.map((row) => ({ id: row.id, key: row.handle })),
    (value) => value,
  );
  const typeIds = match(
    definition.type === null ? [] : [definition.type],
    types.map((row) => ({ id: row.id, key: row.name_key })),
    nameKeyOf,
  );
  if (
    new Set(labelIds).size !== labelIds.length ||
    new Set(assigneeIds).size !== assigneeIds.length
  )
    throw new IssueFormError('FORM_DEFAULTS_INVALID', 'defaults');
  return { labelIds, assigneeIds, typeId: typeIds[0] ?? null };
}
export function validateContentDefinitionIdentity(
  input: SaveDefinitionIdentity,
): void {
  assertId(input.id);
  assertId(input.projectId);
  assertInstant(input.now);
  if (input.expectedRevision !== null) assertRevision(input.expectedRevision);
  if (typeof input.enabled !== 'boolean')
    throw new Error('Invalid enabled flag');
}
export function normalizeSavedForm(input: SaveIssueForm): SaveIssueForm {
  validateContentDefinitionIdentity(input);
  return {
    ...input,
    definition: normalizeIssueFormDefinition(input.definition, 'canonical'),
  };
}
export function validateSavedTemplate(input: SaveIssueTemplate): void {
  validateContentDefinitionIdentity(input);
  validateContent(input.name, input.body);
  if ([...input.name].length > 100 || /[\r\n]/u.test(input.name))
    throw new Error('Invalid template name');
}
