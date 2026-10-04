import { Type, type Static } from '@sinclair/typebox';
import { SafeMarkdownTreeSchema } from './markdown.ts';

const scalar = (maximum: number) => Type.String({ maxLength: maximum });
const id = Type.String({ format: 'uuid' });
const revision = Type.Integer({ minimum: 1, maximum: 2147483647 });
const closed = { additionalProperties: false };
const labelAttributes = { label: scalar(200), description: scalar(2048) };
const required = { required: Type.Boolean() };
const textAttributes = {
  ...labelAttributes,
  placeholder: scalar(16384),
  value: scalar(16384),
};
const textValidations = {
  ...required,
  min_length: Type.Integer({ minimum: 0, maximum: 16384 }),
};
const fieldId = scalar(80);
const FormFieldSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal('markdown'),
      id: fieldId,
      attributes: Type.Object({ value: scalar(8192) }, closed),
    },
    closed,
  ),
  ...(['input', 'textarea'] as const).map((type) =>
    Type.Object(
      {
        type: Type.Literal(type),
        id: fieldId,
        attributes: Type.Object(
          {
            ...textAttributes,
            ...(type === 'textarea'
              ? { render: Type.Optional(scalar(32)) }
              : {}),
          },
          closed,
        ),
        validations: Type.Object(textValidations, closed),
      },
      closed,
    ),
  ),
  Type.Object(
    {
      type: Type.Literal('dropdown'),
      id: fieldId,
      attributes: Type.Object(
        {
          ...labelAttributes,
          options: Type.Array(scalar(200), { minItems: 1, maxItems: 64 }),
          multiple: Type.Boolean(),
          default: Type.Optional(Type.Integer({ minimum: 0, maximum: 63 })),
        },
        closed,
      ),
      validations: Type.Object(required, closed),
    },
    closed,
  ),
  Type.Object(
    {
      type: Type.Literal('checkboxes'),
      id: fieldId,
      attributes: Type.Object(
        {
          ...labelAttributes,
          options: Type.Array(
            Type.Object(
              { label: scalar(200), required: Type.Boolean() },
              closed,
            ),
            { minItems: 1, maxItems: 64 },
          ),
        },
        closed,
      ),
      validations: Type.Object(required, closed),
    },
    closed,
  ),
  Type.Object(
    {
      type: Type.Literal('upload'),
      id: fieldId,
      attributes: Type.Object(labelAttributes, closed),
      validations: Type.Object({ ...required, accept: scalar(1024) }, closed),
    },
    closed,
  ),
]);
export const IssueFormDefinitionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    name: scalar(100),
    description: scalar(500),
    title: scalar(200),
    labels: Type.Array(scalar(100), { maxItems: 32 }),
    assignees: Type.Array(scalar(100), { maxItems: 32 }),
    type: Type.Union([Type.Null(), scalar(100)]),
    body: Type.Array(FormFieldSchema, { minItems: 1, maxItems: 64 }),
  },
  closed,
);
const summaryFields = {
  id,
  projectId: id,
  name: scalar(100),
  enabled: Type.Boolean(),
  revision,
};
export const ContentDefinitionSummarySchema = Type.Object(
  summaryFields,
  closed,
);
export const ContentDefinitionListSchema = Type.Object(
  { items: Type.Array(ContentDefinitionSummarySchema, { maxItems: 64 }) },
  closed,
);
const formSource = {
  yaml: { format: Type.Literal('yaml'), source: scalar(65536) },
  canonical: {
    format: Type.Literal('canonical'),
    definition: IssueFormDefinitionSchema,
  },
};
export const SaveIssueFormRequestSchema = Type.Union(
  Object.values(formSource).map((source) =>
    Type.Object({ ...source, enabled: Type.Boolean() }, closed),
  ),
);
export const ReplaceIssueFormRequestSchema = Type.Union(
  Object.values(formSource).map((source) =>
    Type.Object(
      { ...source, enabled: Type.Boolean(), expectedRevision: revision },
      closed,
    ),
  ),
);
export const SaveIssueTemplateRequestSchema = Type.Object(
  { name: scalar(100), body: scalar(32768), enabled: Type.Boolean() },
  closed,
);
export const ReplaceIssueTemplateRequestSchema = Type.Object(
  {
    name: scalar(100),
    body: scalar(32768),
    enabled: Type.Boolean(),
    expectedRevision: revision,
  },
  closed,
);
const time = Type.String({ format: 'date-time' });
export const IssueFormDocumentSchema = Type.Object(
  {
    ...summaryFields,
    version: revision,
    definition: IssueFormDefinitionSchema,
    createdAt: time,
    contentPolicyVersion: scalar(80),
    representationEtag: scalar(200),
    renderedFields: Type.Array(
      Type.Object(
        {
          id: fieldId,
          valueTree: Type.Optional(SafeMarkdownTreeSchema),
          descriptionTree: Type.Optional(SafeMarkdownTreeSchema),
          optionLabelTrees: Type.Optional(
            Type.Array(SafeMarkdownTreeSchema, { maxItems: 64 }),
          ),
        },
        closed,
      ),
      { maxItems: 64 },
    ),
  },
  closed,
);
export const IssueTemplateDocumentSchema = Type.Object(
  {
    ...summaryFields,
    version: revision,
    body: scalar(32768),
    createdAt: Type.Union([Type.Null(), time]),
    bodyTree: SafeMarkdownTreeSchema,
    contentPolicyVersion: scalar(80),
    representationEtag: scalar(200),
  },
  closed,
);
export type ContentDefinitionList = Static<typeof ContentDefinitionListSchema>;
export type SaveIssueFormRequest = Static<typeof SaveIssueFormRequestSchema>;
export type ReplaceIssueFormRequest = Static<
  typeof ReplaceIssueFormRequestSchema
>;
export type SaveIssueTemplateRequest = Static<
  typeof SaveIssueTemplateRequestSchema
>;
export type ReplaceIssueTemplateRequest = Static<
  typeof ReplaceIssueTemplateRequestSchema
>;
export type IssueFormDocument = Static<typeof IssueFormDocumentSchema>;
export type IssueTemplateDocument = Static<typeof IssueTemplateDocumentSchema>;
export const SubmitIssueFormRequestSchema = Type.Object(
  {
    formVersion: revision,
    draftId: Type.Optional(id),
    title: Type.Optional(scalar(200)),
    values: Type.Record(
      Type.String({ pattern: '^[a-zA-Z0-9_-]{1,80}$' }),
      Type.Union([
        scalar(16384),
        Type.Array(scalar(200), { maxItems: 64 }),
        Type.Array(Type.Integer({ minimum: 0, maximum: 63 }), { maxItems: 64 }),
      ]),
      { maxProperties: 64 },
    ),
  },
  closed,
);
export type SubmitIssueFormRequest = Static<
  typeof SubmitIssueFormRequestSchema
>;
