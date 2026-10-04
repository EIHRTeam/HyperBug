import {
  ContentDefinitionError,
  IssueFormError,
  normalizeIssueFormDefinition,
  validateSavedTemplate,
  type ContentDefinitionStore,
  type ContentDefinitionKind,
  type IssueFormRecord,
  type IssueTemplateRecord,
} from '@hyperbug/application';
import { DomainError } from '@hyperbug/domain';
import { decodeIssueFormYaml } from '@hyperbug/security/issue-form-yaml';
import {
  contentPolicyVersion,
  deriveMarkdownTree,
  markdownRepresentationEtag,
} from '@hyperbug/security/markdown';
import { credentialFactsOf, requireAuthorizedAction } from './authorization.ts';
import {
  projectBearer,
  requireVisibleProject,
  type ProjectContext,
} from './projects.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';
import { contentRepresentation } from './content.ts';

export interface ContentDefinitionContext extends ProjectContext {
  readonly contentDefinitions: ContentDefinitionStore | null;
}
function store(context: ContentDefinitionContext): ContentDefinitionStore {
  if (!context.contentDefinitions)
    throw new RequestFailure('CONTENT_UNAVAILABLE');
  return context.contentDefinitions;
}
async function permit(
  request: Request,
  context: ContentDefinitionContext,
  projectId: string,
  permission: 'project:read' | 'content:manage' | 'content:history',
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (permission !== 'project:read' && !principal)
    throw new RequestFailure('AUTHENTICATION_REQUIRED');
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  await requireAuthorizedAction({
    httpRequest: request,
    request: {
      actorId: principal?.principalId ?? null,
      permission,
      target: { projectId, type: 'project', id: projectId },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
    credential: credentialFactsOf(principal),
  });
}
/** Derive only after visibility checks. Canonical definitions remain editor data. */
export function issueFormView(record: IssueFormRecord) {
  const { createdAtMs, ...rest } = record;
  return {
    ...rest,
    createdAt: new Date(createdAtMs).toISOString(),
    renderedFields: record.definition.body.map((field) => ({
      id: field.id,
      ...(field.type === 'markdown'
        ? { valueTree: deriveMarkdownTree(field.attributes.value) }
        : {
            descriptionTree: deriveMarkdownTree(field.attributes.description),
            ...(field.type === 'checkboxes'
              ? {
                  optionLabelTrees: field.attributes.options.map((option) =>
                    deriveMarkdownTree(option.label),
                  ),
                }
              : {}),
          }),
    })),
    contentPolicyVersion,
    representationEtag: markdownRepresentationEtag(
      `${record.id}_${record.version}`,
      record.revision,
      'tree',
    ),
  };
}
function templateView(record: IssueTemplateRecord) {
  const { createdAtMs, ...rest } = record;
  return {
    ...rest,
    createdAt:
      createdAtMs === null ? null : new Date(createdAtMs).toISOString(),
    ...contentRepresentation(
      `${record.id}_${record.version}`,
      record.revision,
      record.body,
    ),
  };
}
function mapFailure(error: unknown): never {
  if (error instanceof RequestFailure) throw error;
  if (
    error instanceof ContentDefinitionError ||
    error instanceof IssueFormError
  )
    throw new RequestFailure(error.code);
  if (
    error instanceof DomainError &&
    ['NOT_FOUND', 'REVISION_CONFLICT'].includes(error.code)
  )
    throw new RequestFailure(error.code as 'NOT_FOUND' | 'REVISION_CONFLICT');
  throw new RequestFailure('CONTENT_UNAVAILABLE');
}
export async function listContentDefinitions(
  request: Request,
  context: ContentDefinitionContext,
  projectId: string,
  kind: ContentDefinitionKind,
  includeDisabled: boolean,
) {
  await permit(
    request,
    context,
    projectId,
    includeDisabled ? 'content:history' : 'project:read',
  );
  try {
    return await withDeadline(request.signal, 1000, () =>
      store(context).list(kind, projectId, includeDisabled),
    );
  } catch (error) {
    mapFailure(error);
  }
}
export async function readContentDefinition(
  request: Request,
  context: ContentDefinitionContext,
  projectId: string,
  kind: ContentDefinitionKind,
  id: string,
  version?: number,
) {
  await permit(
    request,
    context,
    projectId,
    version === undefined ? 'project:read' : 'content:history',
  );
  try {
    const record = await withDeadline(request.signal, 1000, async () =>
      kind === 'form'
        ? store(context).getForm(projectId, id, version)
        : store(context).getTemplate(projectId, id, version),
    );
    if (!record) throw new RequestFailure('NOT_FOUND');
    if (!record.enabled && version === undefined) {
      try {
        await permit(request, context, projectId, 'content:history');
      } catch (error) {
        if (
          error instanceof RequestFailure &&
          ['AUTHENTICATION_REQUIRED', 'FORBIDDEN'].includes(error.code)
        )
          throw new RequestFailure('NOT_FOUND');
        throw error;
      }
    }
    return 'definition' in record
      ? issueFormView(record)
      : templateView(record);
  } catch (error) {
    mapFailure(error);
  }
}
export async function saveContentDefinition(
  request: Request,
  context: ContentDefinitionContext,
  projectId: string,
  kind: ContentDefinitionKind,
  id: string,
  expectedRevision: number | null,
  input: {
    enabled: boolean;
    format?: 'yaml' | 'canonical';
    source?: string;
    definition?: unknown;
    name?: string;
    body?: string;
  },
) {
  await permit(request, context, projectId, 'content:manage');
  const identity = {
    id,
    projectId,
    expectedRevision,
    enabled: input.enabled,
    now: Date.now(),
  };
  if (kind === 'form') {
    let definition;
    try {
      definition = normalizeIssueFormDefinition(
        input.format === 'yaml'
          ? decodeIssueFormYaml(input.source!)
          : input.definition,
        input.format === 'yaml' ? 'github' : 'canonical',
      );
      // The same policy used on read also bounds authored Markdown before persistence.
      issueFormView({
        ...identity,
        revision: (expectedRevision ?? 0) + 1,
        version: (expectedRevision ?? 0) + 1,
        name: definition.name,
        definition,
        createdAtMs: identity.now,
      });
    } catch (error) {
      if (error instanceof IssueFormError) throw new RequestFailure(error.code);
      throw new RequestFailure('FORM_DEFINITION_INVALID');
    }
    try {
      return issueFormView(
        await withDeadline(request.signal, 1000, () =>
          store(context).saveForm({ ...identity, definition }),
        ),
      );
    } catch (error) {
      mapFailure(error);
    }
  }
  const template = { ...identity, name: input.name!, body: input.body! };
  try {
    validateSavedTemplate(template);
    deriveMarkdownTree(template.body);
  } catch {
    throw new RequestFailure('CONTENT_INVALID');
  }
  try {
    return templateView(
      await withDeadline(request.signal, 1000, () =>
        store(context).saveTemplate(template),
      ),
    );
  } catch (error) {
    mapFailure(error);
  }
}
