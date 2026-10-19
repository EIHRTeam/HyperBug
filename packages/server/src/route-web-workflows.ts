import { t, type AnyElysia } from 'elysia';
import {
  AuditFailure,
  createAuditService,
  type AuditRepository,
} from '@hyperbug/security';
import {
  contentPolicyVersion,
  deriveMarkdownTree,
  MarkdownPolicyError,
} from '@hyperbug/security/markdown';
import {
  PreviewContentRequestSchema,
  PreviewContentSchema,
  AuditBrowseQuerySchema,
  AuditBrowsePageSchema,
  type PreviewContentRequest,
  type PreviewContent,
  type AuditBrowsePage,
} from '@hyperbug/contracts';
import type { IssueContext } from './issues.ts';
import {
  validateIssueFormAnswers,
  IssueFormError,
} from '@hyperbug/application';
import { withDeadline, storeReadTimeoutMs } from './bounds.ts';
import { projectBearer, requireVisibleProject } from './projects.ts';
import { credentialFactsOf, requireAuthorizedAction } from './authorization.ts';
import { refreshAuthorizationFacts } from './authorization-facts.ts';
import { RequestFailure } from './errors.ts';
import { securityDecisionTimeoutMs } from './bounds.ts';

export function webWorkflowRoutes(
  app: AnyElysia,
  context: IssueContext,
  auditRepository: AuditRepository | null,
) {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  return app
    .post(
      '/api/v1/projects/:projectId/content/preview',
      async ({ request, params, body }): Promise<PreviewContent> => {
        const projectId = params.projectId;
        if (!projectId || !uuid.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        await requireVisibleProject(request, context, projectId);
        const principal = await projectBearer(request, context);
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        if (!context.authorizationResolver)
          throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
        await requireAuthorizedAction({
          httpRequest: request,
          request: {
            actorId: principal.principalId,
            permission: 'issue:create',
            target: { projectId, type: 'project', id: projectId },
          },
          resolver: context.authorizationResolver,
          policy: context.authorizationPolicy,
          signal: request.signal,
          credential: credentialFactsOf(principal),
        });
        if (context.admission)
          await context.admission.requireRate({
            request,
            category: 'comment-create',
            checks: [
              {
                dimension: 'principal',
                canonicalSubject: principal.principalId,
                rule: { limit: 120, windowMs: 3600000, retentionMs: 86400000 },
              },
              {
                dimension: 'project',
                canonicalSubject: projectId,
                rule: { limit: 2400, windowMs: 3600000, retentionMs: 86400000 },
              },
            ],
            nowMs: Date.now(),
            signal: request.signal,
            timeoutMs: securityDecisionTimeoutMs(request.signal),
          });
        request.signal.throwIfAborted();
        try {
          const input = body as PreviewContentRequest;
          let markdown: string;
          if ('body' in input) markdown = input.body;
          else {
            if (!context.contentDefinitions)
              throw new RequestFailure('CONTENT_UNAVAILABLE');
            const form = await withDeadline(
              request.signal,
              storeReadTimeoutMs(request.signal),
              () =>
                context.contentDefinitions!.getForm(projectId, input.formId),
            );
            if (!form || !form.enabled || form.version !== input.formVersion)
              throw new RequestFailure('FORM_VERSION_STALE');
            markdown = validateIssueFormAnswers(
              form.definition,
              input.values,
            ).markdown;
          }
          return {
            bodyTree: deriveMarkdownTree(markdown),
            contentPolicyVersion,
          } as PreviewContent;
        } catch (error) {
          if (error instanceof MarkdownPolicyError)
            throw new RequestFailure('ISSUE_INVALID');
          if (error instanceof IssueFormError)
            throw new RequestFailure(error.code);
          throw error;
        }
      },
      {
        body: t.Unsafe<PreviewContentRequest>(PreviewContentRequestSchema),
        response: t.Unsafe<PreviewContent>(PreviewContentSchema),
      },
    )
    .get(
      '/api/v1/projects/:projectId/audit',
      async ({ request, params, query }): Promise<AuditBrowsePage> => {
        const projectId = params.projectId;
        if (!projectId || !uuid.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        await requireVisibleProject(request, context, projectId);
        const principal = await projectBearer(request, context);
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        const resolver = context.authorizationResolver;
        if (!resolver) throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
        if (!auditRepository) throw new RequestFailure('AUDIT_UNAVAILABLE');
        try {
          const service = createAuditService({
            repository: auditRepository,
            policy: context.authorizationPolicy,
            authorization: {
              resolve: (input, signal) => {
                refreshAuthorizationFacts(request, resolver);
                return resolver.resolve(
                  input,
                  signal,
                  credentialFactsOf(principal),
                );
              },
            },
          });
          const page = await service.read(
            {
              actorId: principal.principalId,
              projectId,
              ...(query.limit !== undefined
                ? { limit: Number(query.limit) }
                : { limit: 20 }),
              ...(query.after !== undefined
                ? { after: String(query.after) }
                : {}),
            },
            request.signal,
          );
          return {
            items: page.items.map((event) => ({
              id: event.id,
              projectId,
              actorId: event.actorId,
              systemActor: event.systemActor,
              action: event.action,
              targetId: event.targetId,
              result: event.result,
              createdAt: new Date(event.createdAt).toISOString(),
            })),
            nextCursor: page.nextCursor,
          };
        } catch (error) {
          if (error instanceof AuditFailure && error.code === 'AUDIT_FORBIDDEN')
            throw new RequestFailure('FORBIDDEN');
          if (error instanceof AuditFailure && error.code === 'AUDIT_INVALID')
            throw new RequestFailure('INVALID_CURSOR');
          throw new RequestFailure('AUDIT_UNAVAILABLE');
        }
      },
      {
        query: t.Unsafe<{ limit?: string | number; after?: string }>(
          AuditBrowseQuerySchema,
        ),
        response: t.Unsafe<AuditBrowsePage>(AuditBrowsePageSchema),
      },
    );
}
