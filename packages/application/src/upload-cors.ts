import { UploadIntentError } from './upload-intents.ts';

export interface UploadCorsRule {
  AllowedOrigins: string[];
  AllowedMethods: string[];
  AllowedHeaders: string[];
  ExposeHeaders: string[];
  MaxAgeSeconds: number;
}
/** Provider-neutral S3/R2 policy preparation; it never changes a bucket. */
export function createUploadCorsRules(
  origins: readonly string[],
  allowLocalHttp = false,
): UploadCorsRule[] {
  if (
    !Array.isArray(origins) ||
    origins.length < 1 ||
    origins.length > 16 ||
    new Set(origins).size !== origins.length
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  for (const origin of origins) {
    try {
      if (
        typeof origin !== 'string' ||
        origin.length > 2048 ||
        origin.includes('*')
      )
        throw new Error();
      const url = new URL(origin);
      if (
        url.origin !== origin ||
        url.username ||
        url.password ||
        (url.protocol !== 'https:' &&
          !(
            allowLocalHttp &&
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
          ))
      )
        throw new Error();
    } catch {
      throw new UploadIntentError('UPLOAD_INVALID');
    }
  }
  return [
    {
      AllowedOrigins: [...origins].sort(),
      AllowedMethods: ['PUT', 'GET', 'HEAD'],
      AllowedHeaders: ['Content-Type', 'Range'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 300,
    },
  ];
}
/** Reject extra rules, wildcard origins/headers and policy drift in an operator-exported snapshot. */
export function validateUploadCorsRules(
  value: unknown,
  origins: readonly string[],
  allowLocalHttp = false,
): void {
  const expected = createUploadCorsRules(origins, allowLocalHttp)[0]!;
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    !value[0] ||
    typeof value[0] !== 'object'
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  const rule = value[0] as Record<string, unknown>;
  if (
    Object.keys(rule).sort().join(',') !==
      Object.keys(expected).sort().join(',') ||
    rule.MaxAgeSeconds !== expected.MaxAgeSeconds
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  for (const key of [
    'AllowedOrigins',
    'AllowedMethods',
    'AllowedHeaders',
    'ExposeHeaders',
  ] as const) {
    const list = rule[key];
    if (
      !Array.isArray(list) ||
      list.some((item) => typeof item !== 'string') ||
      [...list].sort().join('\n') !== [...expected[key]].sort().join('\n')
    )
      throw new UploadIntentError('UPLOAD_INVALID');
  }
}
