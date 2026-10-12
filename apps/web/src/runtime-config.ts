export interface RuntimeConfig {
  readonly schemaVersion: 1;
  readonly applicationName: string;
  readonly apiBaseUrl: string;
  readonly authBaseUrl: string;
  readonly mediaOrigins: readonly string[];
}

export function publicOrigin(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048)
    throw new Error('INVALID_CONFIGURATION');
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      ))
  )
    throw new Error('INVALID_CONFIGURATION');
  return url.origin;
}

export function validateRuntimeConfig(input: unknown): RuntimeConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('INVALID_CONFIGURATION');
  const value = input as Record<string, unknown>;
  const keys = [
    'schemaVersion',
    'applicationName',
    'apiBaseUrl',
    'authBaseUrl',
    'mediaOrigins',
  ];
  if (
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key)) ||
    value.schemaVersion !== 1 ||
    typeof value.applicationName !== 'string' ||
    !value.applicationName.trim() ||
    value.applicationName.length > 100 ||
    [...value.applicationName].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    !Array.isArray(value.mediaOrigins) ||
    value.mediaOrigins.length > 16
  )
    throw new Error('INVALID_CONFIGURATION');
  const mediaOrigins = value.mediaOrigins.map(publicOrigin);
  if (new Set(mediaOrigins).size !== mediaOrigins.length)
    throw new Error('INVALID_CONFIGURATION');
  return Object.freeze({
    schemaVersion: 1,
    applicationName: value.applicationName.trim(),
    apiBaseUrl: publicOrigin(value.apiBaseUrl),
    authBaseUrl: publicOrigin(value.authBaseUrl),
    mediaOrigins: Object.freeze(mediaOrigins),
  });
}

export async function loadRuntimeConfig(
  fetcher: typeof fetch = fetch,
): Promise<RuntimeConfig> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher('/config.json', {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (
      !response.ok ||
      !response.headers.get('content-type')?.startsWith('application/json')
    )
      throw new Error('INVALID_CONFIGURATION');
    if (!response.body) throw new Error('INVALID_CONFIGURATION');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      async function readNext(): Promise<void> {
        const { done, value } = await reader.read();
        if (done) return;
        size += value.byteLength;
        if (size > 16384) throw new Error('INVALID_CONFIGURATION');
        chunks.push(value);
        return readNext();
      }
      await readNext();
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return validateRuntimeConfig(JSON.parse(new TextDecoder().decode(bytes)));
  } finally {
    clearTimeout(timer);
  }
}
