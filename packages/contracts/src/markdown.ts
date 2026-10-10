import { Type } from '@sinclair/typebox';

export const SafeMarkdownNodeSchema = Type.Recursive(
  (Self) =>
    Type.Union([
      Type.Object(
        {
          type: Type.Literal('text'),
          value: Type.String({ maxLength: 131072 }),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          type: Type.Literal('element'),
          tagName: Type.String({ maxLength: 16 }),
          properties: Type.Record(
            Type.String({ maxLength: 32 }),
            Type.Union([
              Type.String({ maxLength: 131072 }),
              Type.Number(),
              Type.Boolean(),
              Type.Array(Type.String({ maxLength: 64 }), { maxItems: 8 }),
            ]),
          ),
          children: Type.Array(Self, { maxItems: 8192 }),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          type: Type.Literal('image'),
          source: Type.Union([
            Type.Object(
              {
                kind: Type.Literal('external'),
                url: Type.String({ maxLength: 2048 }),
              },
              { additionalProperties: false },
            ),
            Type.Object(
              {
                kind: Type.Literal('attachment'),
                id: Type.String({ format: 'uuid' }),
              },
              { additionalProperties: false },
            ),
          ]),
          alt: Type.String({ maxLength: 131072 }),
          title: Type.Union([Type.Null(), Type.String({ maxLength: 131072 })]),
        },
        { additionalProperties: false },
      ),
    ]),
  { $id: 'SafeMarkdownNode' },
);
export const SafeMarkdownTreeSchema = Type.Object(
  {
    type: Type.Literal('root'),
    children: Type.Array(SafeMarkdownNodeSchema, { maxItems: 8192 }),
  },
  { additionalProperties: false },
);
