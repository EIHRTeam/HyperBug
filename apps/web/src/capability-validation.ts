import type { InstanceDocument } from '@hyperbug/api-client';

// This bounded interpreter uses the exact public schema embedded at build time.
// No duplicate instance schema or TypeBox/server implementation ships to browsers.
function matches(schema: Record<string, unknown>, value: unknown): boolean {
  if ('const' in schema && value !== schema.const) return false;
  if (Array.isArray(schema.anyOf))
    return schema.anyOf.some((item) => matches(item, value));
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const object = value as Record<string, unknown>;
    const properties = schema.properties as Record<
      string,
      Record<string, unknown>
    >;
    const required = schema.required as string[];
    return (
      required.every((key) => Object.hasOwn(object, key)) &&
      Object.keys(object).every(
        (key) =>
          properties[key] !== undefined &&
          matches(properties[key], object[key]),
      )
    );
  }
  if (schema.type === 'array')
    return (
      Array.isArray(value) &&
      value.length <= Number(schema.maxItems ?? 100) &&
      (!schema.uniqueItems || new Set(value).size === value.length) &&
      value.every((item) =>
        matches(schema.items as Record<string, unknown>, item),
      )
    );
  if (schema.type === 'string')
    return (
      typeof value === 'string' &&
      value.length >= Number(schema.minLength ?? 0) &&
      value.length <= Number(schema.maxLength ?? 2048) &&
      (typeof schema.pattern !== 'string' ||
        new RegExp(schema.pattern).test(value))
    );
  if (schema.type === 'boolean') return typeof value === 'boolean';
  if (schema.type === 'number')
    return typeof value === 'number' && Number.isFinite(value);
  if (schema.type === 'integer')
    return (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= Number(schema.minimum ?? Number.MIN_SAFE_INTEGER) &&
      value <= Number(schema.maximum ?? Number.MAX_SAFE_INTEGER)
    );
  return false;
}
export function validateInstanceDocument(
  value: unknown,
  schema: Record<string, unknown>,
): InstanceDocument {
  if (!matches(schema, value)) throw new Error('INVALID_INSTANCE_DOCUMENT');
  return value as InstanceDocument;
}
