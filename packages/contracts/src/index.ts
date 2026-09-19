import { Type, type Static } from '@sinclair/typebox';

export const ErrorSchema = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String(),
        message: Type.String(),
        requestId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type ErrorResponse = Static<typeof ErrorSchema>;
export const HealthSchema = Type.Object(
  { status: Type.Union([Type.Literal('ok'), Type.Literal('unavailable')]) },
  { additionalProperties: false },
);
export const EchoSchema = Type.Object(
  { message: Type.String({ minLength: 1, maxLength: 100 }) },
  { additionalProperties: false },
);
export type Echo = Static<typeof EchoSchema>;
