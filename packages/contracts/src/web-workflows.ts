import { Type, type Static } from '@sinclair/typebox';
import { SafeMarkdownTreeSchema } from './markdown.ts';
import { SubmitIssueFormRequestSchema } from './content-definitions.ts';
const closed = { additionalProperties: false };
export const PreviewContentRequestSchema = Type.Union([
  Type.Object({ body: Type.String({ maxLength: 131072 }) }, closed),
  Type.Object(
    {
      formId: Type.String({ format: 'uuid' }),
      formVersion: Type.Integer({ minimum: 1, maximum: 2147483647 }),
      values: SubmitIssueFormRequestSchema.properties.values,
    },
    closed,
  ),
]);
export const PreviewContentSchema = Type.Object(
  {
    bodyTree: SafeMarkdownTreeSchema,
    contentPolicyVersion: Type.String({ maxLength: 80 }),
  },
  closed,
);
export const AuditBrowseQuerySchema = Type.Object(
  {
    limit: Type.Optional(
      Type.Union([
        Type.Integer({ minimum: 1, maximum: 100 }),
        Type.String({ pattern: '^(?:[1-9][0-9]?|100)$' }),
      ]),
    ),
    after: Type.Optional(Type.String({ maxLength: 1024 })),
  },
  closed,
);
export const AuditBrowsePageSchema = Type.Object(
  {
    items: Type.Array(
      Type.Object(
        {
          id: Type.String({ format: 'uuid' }),
          projectId: Type.String({ format: 'uuid' }),
          actorId: Type.Union([Type.Null(), Type.String({ format: 'uuid' })]),
          systemActor: Type.Union([
            Type.Null(),
            Type.String({ maxLength: 80 }),
          ]),
          action: Type.String({ maxLength: 80 }),
          targetId: Type.String({ maxLength: 200 }),
          result: Type.Union([
            Type.Literal('success'),
            Type.Literal('failure'),
          ]),
          createdAt: Type.String({ format: 'date-time' }),
        },
        closed,
      ),
      { maxItems: 100 },
    ),
    nextCursor: Type.Union([Type.Null(), Type.String({ maxLength: 1024 })]),
  },
  closed,
);
export type PreviewContentRequest = Static<typeof PreviewContentRequestSchema>;
export type PreviewContent = Static<typeof PreviewContentSchema>;
export type AuditBrowsePage = Static<typeof AuditBrowsePageSchema>;
