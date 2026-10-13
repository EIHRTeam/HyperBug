import { Type, type Static } from '@sinclair/typebox';
const closed = { additionalProperties: false };
const id = Type.String({
  pattern:
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
});
export const UploadAssociationSchema = Type.Union([
  Type.Object({ kind: Type.Literal('issue-draft'), draftId: id }, closed),
  Type.Object(
    { kind: Type.Literal('comment-draft'), draftId: id, issueId: id },
    closed,
  ),
  Type.Object({ kind: Type.Literal('issue'), issueId: id }, closed),
  Type.Object({ kind: Type.Literal('comment'), commentId: id }, closed),
]);
export const ReserveUploadRequestSchema = Type.Object(
  {
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    contentType: Type.String({ minLength: 3, maxLength: 255 }),
    maxBytes: Type.Integer({ minimum: 1, maximum: 33554432 }),
    association: UploadAssociationSchema,
  },
  closed,
);
export const UploadDocumentSchema = Type.Object(
  {
    id,
    projectId: id,
    filename: Type.String(),
    contentType: Type.String(),
    maxBytes: Type.Integer(),
    association: UploadAssociationSchema,
    state: Type.Union(
      [
        'pending',
        'awaiting-processing',
        'quarantined',
        'awaiting-scan',
        'ready',
        'expired',
        'rejected',
      ].map((state) => Type.Literal(state)),
    ),
    scanStatus: Type.Union(
      ['unscanned', 'pending', 'clean', 'infected', 'failed'].map((state) =>
        Type.Literal(state),
      ),
    ),
    policyState: Type.Union([
      Type.Literal('quarantined'),
      Type.Literal('rejected'),
      Type.Literal('ready'),
    ]),
    revision: Type.Integer(),
    createdAt: Type.String({ format: 'date-time' }),
    expiresAt: Type.String({ format: 'date-time' }),
    transfer: Type.Union([
      Type.Object({ mode: Type.Literal('direct') }, closed),
      Type.Object(
        {
          mode: Type.Literal('multipart'),
          partBytes: Type.Integer(),
          maxParts: Type.Integer(),
        },
        closed,
      ),
    ]),
    actualBytes: Type.Union([Type.Integer(), Type.Null()]),
  },
  closed,
);
export const UploadCapabilitySchema = Type.Object(
  {
    method: Type.Literal('PUT'),
    url: Type.String({ format: 'uri' }),
    headers: Type.Record(Type.String(), Type.String()),
    expiresAt: Type.String({ format: 'date-time' }),
  },
  closed,
);
export type ReserveUploadRequest = Static<typeof ReserveUploadRequestSchema>;
export type UploadDocument = Static<typeof UploadDocumentSchema>;
export type UploadCapabilityDocument = Static<typeof UploadCapabilitySchema>;

export const MultipartPartReceiptSchema = Type.Object(
  {
    partNumber: Type.Integer({ minimum: 1, maximum: 10000 }),
    etag: Type.String({ minLength: 1, maxLength: 256 }),
    sizeBytes: Type.Integer({ minimum: 1, maximum: 33554432 }),
  },
  closed,
);
export const MultipartPartRequestSchema = Type.Object(
  {
    expectedRevision: Type.Integer({ minimum: 1, maximum: 2147483647 }),
    etag: Type.String({ minLength: 1, maxLength: 256 }),
    sizeBytes: Type.Integer({ minimum: 1, maximum: 33554432 }),
  },
  closed,
);
export const MultipartCompleteRequestSchema = Type.Object(
  { expectedRevision: Type.Integer({ minimum: 1, maximum: 2147483647 }) },
  closed,
);
export const MultipartDocumentSchema = Type.Object(
  {
    id,
    projectId: id,
    state: Type.Union(
      [
        'planned',
        'creating',
        'active',
        'completing',
        'completed',
        'aborting',
        'aborted',
      ].map((state) => Type.Literal(state)),
    ),
    partBytes: Type.Integer(),
    maxParts: Type.Integer(),
    revision: Type.Integer(),
    parts: Type.Array(MultipartPartReceiptSchema, { maxItems: 100 }),
  },
  closed,
);
export type MultipartDocument = Static<typeof MultipartDocumentSchema>;
export type MultipartPartRequest = Static<typeof MultipartPartRequestSchema>;
export type MultipartCompleteRequest = Static<
  typeof MultipartCompleteRequestSchema
>;
