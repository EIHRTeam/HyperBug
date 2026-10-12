import { createApp } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import * as contracts from '@hyperbug/contracts';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { routeLabelFor } from '../packages/server/src/route-labels.ts';
import { node } from '@elysia/node';
import { execFileSync } from 'node:child_process';
import { failures } from '../packages/server/src/errors.ts';

type Schema = Record<string, unknown>;
const json = (value: unknown): Schema => JSON.parse(JSON.stringify(value));
const schemas = Object.fromEntries(
  Object.entries(contracts)
    .filter(([name]) => name.endsWith('Schema'))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => [name.slice(0, -6), json(value)]),
);
const referenceIds = new Map<string, string>();
for (const [name, schema] of Object.entries(schemas))
  if (typeof schema.$id === 'string') referenceIds.set(schema.$id, name);

/** TypeBox emits JSON Schema directly; resolve its recursive IDs for OpenAPI. */
function portable(schema: Schema): Schema {
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => key !== '$id')
      .map(([key, value]) => {
        if (key === '$ref') {
          const name = referenceIds.get(String(value));
          if (!name) throw new Error('Unknown public schema reference');
          return [key, `#/components/schemas/${name}`];
        }
        if (Array.isArray(value))
          return [
            key,
            value.map((v) => (v && typeof v === 'object' ? portable(v) : v)),
          ];
        return [
          key,
          value && typeof value === 'object'
            ? portable(value as Schema)
            : value,
        ];
      }),
  );
}
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
function schemaRef(schema: Schema): Schema {
  const serialized = JSON.stringify(schema);
  const match = Object.entries(schemas).find(
    ([, candidate]) => JSON.stringify(candidate) === serialized,
  );
  return match ? ref(match[0]) : portable(schema);
}

export function publicRoutes() {
  // Build-time introspection only: no listener, services, credentials or I/O.
  return createApp({
    adapter: node(),
    config: loadConfig(
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
      'node',
    ),
    telemetry: { request() {} },
    ready: async () => true,
  }).routes;
}

function receipt(path: string, method: string): 'none' | 'key' | 'resource' {
  if (method === 'PUT' && /\/uploads\/:uploadId$/.test(path)) return 'resource';
  if (/\/issues$/.test(path) && method === 'POST') return 'key';
  if (/\/forms\/:definitionId\/submissions$/.test(path) && method === 'POST')
    return 'key';
  if (/\/issues\/:issueId$/.test(path) && method === 'PATCH') return 'key';
  if (
    /\/issues\/:issueId\/(close|reopen|labels|assignees|type|milestone)$/.test(
      path,
    ) &&
    ['POST', 'PUT'].includes(method)
  )
    return 'key';
  if (/\/issues\/:issueId\/comments$/.test(path) && method === 'POST')
    return 'key';
  if (
    /\/issues\/:issueId\/comments\/:commentId$/.test(path) &&
    method === 'PATCH'
  )
    return 'key';
  return 'none';
}
function auth(path: string, method: string) {
  if (
    path.startsWith('/health/') ||
    path === '/api/v1/instance' ||
    path === '/api/v1/accounts/register'
  )
    return 'public';
  if (path.startsWith('/auth/')) {
    if (
      [
        '/auth/session',
        '/auth/logout',
        '/auth/recovery-codes',
        '/auth/passkey/register/options',
        '/auth/passkey/register',
        '/auth/authorize',
        '/auth/authorize/consent',
      ].includes(path)
    )
      return 'first-party-session';
    return 'public-protocol';
  }
  if (
    method === 'GET' &&
    path.startsWith('/api/v1/projects/') &&
    !/\/(uploads|members)(\/|$)/.test(path)
  )
    return 'optional-bearer';
  return 'bearer';
}
function rate(path: string, method: string) {
  if (/\/uploads(?:\/|$)/.test(path) && method !== 'GET')
    return 'attachment-upload: authoritative principal/project (120/2400 per hour)';
  if (/\/search(?:\/|$)/.test(path))
    return 'search: bounded admission, candidate and tier quota limits; SEARCH-SPEC';
  if (path === '/api/v1/accounts/register' && method === 'POST')
    return 'registration: trusted IP/account before password/CAPTCHA';
  if (/^\/auth\/(login|token|recover|passkey)/.test(path))
    return 'authentication: route-specific trusted IP/account admission before expensive work; AUTH-FLOWS';
  if (path === '/auth/session' || path === '/auth/logout')
    return 'distinct trusted-IP approximate bucket before primary session access';
  if (path.includes('/issues') && !['GET', 'DELETE'].includes(method))
    return 'issue/comment writes: authoritative route-specific admission; RATE-LIMITING';
  return 'global bounded input/deadline; no additional per-route limiter advertised';
}

// Explicit contracts for handlers returning native Responses or opaque WebAuthn.
function responseSchemas(
  path: string,
  method: string,
  declared: unknown,
): Record<string, Schema> {
  if (declared !== undefined) {
    const schema = json(declared);
    return schema.type || schema.anyOf || schema.$ref
      ? { '200': schema }
      : (schema as Record<string, Schema>);
  }
  if (method === 'DELETE' && path.includes('/reactions/'))
    return { '200': schemas.ReactionOutcome! };
  if (
    method === 'DELETE' ||
    ['/auth/logout', '/auth/token/revoke'].includes(path)
  )
    return { '204': { type: 'null' } };
  if (path === '/auth/authorize' && method === 'GET')
    return { '200': { type: 'string' }, '302': { type: 'null' } };
  if (path === '/auth/authorize/login' || path === '/auth/authorize/consent')
    return { '303': { type: 'null' } };
  if (path === '/auth/passkey/register')
    return {
      '200': {
        type: 'object',
        properties: { registered: { const: true } },
        required: ['registered'],
        additionalProperties: false,
      },
    };
  if (path.endsWith('/options'))
    return {
      '200': {
        type: 'object',
        additionalProperties: true,
        description:
          'WebAuthn JSON options from the configured relying party. Treat as an opaque WebAuthn document.',
      },
    };
  if (path === '/api/v1/admin/plugins/configuration')
    return {
      '200': {
        type: 'object',
        properties: {
          settings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                kind: { enum: ['public', 'secret'] },
                value: { type: ['string', 'number', 'boolean'] },
                secretPresent: { type: 'boolean' },
              },
              required: ['key', 'kind'],
              additionalProperties: false,
            },
          },
        },
        required: ['settings'],
        additionalProperties: false,
      },
    };
  throw new Error(`Missing public response contract: ${method} ${path}`);
}

export function generatePublicApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  const operations: Record<string, unknown> = {};
  const types: string[] = [];
  for (const route of publicRoutes()) {
    if (
      !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(route.method)
    )
      throw new Error('Unclassified route method');
    if (route.path.startsWith('/_proof')) continue;
    const path = route.path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, '{$1}');
    const id = `${route.method} ${path}`;
    const parameters: Schema[] = [
      ...route.path.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g),
    ].map((match) => ({
      name: match[1],
      in: 'path',
      required: true,
      schema: {
        type: 'string',
        ...(match[1] === 'reaction'
          ? {
              enum: [
                'thumbs_up',
                'thumbs_down',
                'laugh',
                'hooray',
                'confused',
                'heart',
                'rocket',
                'eyes',
              ],
            }
          : match[1] === 'partNumber'
            ? { pattern: '^[1-9][0-9]{0,3}$' }
            : { format: 'uuid' }),
      },
    }));
    const query =
      route.path === '/auth/authorize' && route.method === 'GET'
        ? {
            type: 'object',
            properties: Object.fromEntries(
              [
                'response_type',
                'client_id',
                'redirect_uri',
                'scope',
                'state',
                'code_challenge',
                'code_challenge_method',
              ].map((name) => [name, { type: 'string', maxLength: 2048 }]),
            ),
            required: [
              'response_type',
              'client_id',
              'redirect_uri',
              'scope',
              'state',
              'code_challenge',
              'code_challenge_method',
            ],
            additionalProperties: false,
          }
        : route.hooks.query
          ? json(route.hooks.query)
          : undefined;
    if (query)
      for (const [name, value] of Object.entries(query.properties as Schema))
        parameters.push({
          name,
          in: 'query',
          required:
            (query.required as string[] | undefined)?.includes(name) ?? false,
          schema: schemaRef(value as Schema),
        });
    const replay = receipt(route.path, route.method);
    if (replay === 'key')
      parameters.push({
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,128}$' },
        description:
          'Same key and exact payload; authorized 24-hour receipt. Without a key the mutation is one-shot.',
      });
    let body = route.hooks.body ? json(route.hooks.body) : undefined;
    let contentType = 'application/json';
    if (
      [
        '/auth/token',
        '/auth/token/revoke',
        '/auth/authorize/login',
        '/auth/authorize/consent',
      ].includes(route.path)
    ) {
      contentType = 'application/x-www-form-urlencoded';
      const names =
        route.path === '/auth/token'
          ? ['grant_type', 'client_id', 'redirect_uri', 'code', 'code_verifier']
          : route.path === '/auth/token/revoke'
            ? ['token']
            : [
                'response_type',
                'client_id',
                'redirect_uri',
                'scope',
                'state',
                'code_challenge',
                'code_challenge_method',
                ...(route.path.endsWith('/login')
                  ? ['handle', 'password']
                  : []),
              ];
      body = {
        type: 'object',
        properties: Object.fromEntries(
          names.map((name) => [name, { type: 'string' }]),
        ),
        required: names,
        additionalProperties: false,
      };
      if (route.path.endsWith('/authorize/login'))
        (body.properties as Schema).captchaToken = {
          type: 'string',
          minLength: 1,
          maxLength: 4096,
        };
    }
    const responses: Record<string, Schema> = {};
    const declared = responseSchemas(
      route.path,
      route.method,
      route.hooks.response,
    );
    for (const [status, schema] of Object.entries(declared))
      responses[status] = {
        description:
          status === '204' || status === '304'
            ? 'No response body'
            : 'Documented result',
        headers: {
          'X-Request-ID': { schema: { type: 'string', format: 'uuid' } },
          ...(route.path === '/api/v1/instance'
            ? { ETag: { schema: { type: 'string' } } }
            : {}),
        },
        ...(['204', '304', '302', '303'].includes(status)
          ? {}
          : {
              content: {
                [route.path === '/auth/authorize' && route.method === 'GET'
                  ? 'text/html'
                  : 'application/json']: { schema: schemaRef(schema) },
              },
            }),
      };
    responses.default = {
      description:
        'Closed safe error envelope. Possible status/code depends on the route and global boundary; see API-CONVENTIONS and the error catalog.',
      headers: {
        'X-Request-ID': { schema: { type: 'string', format: 'uuid' } },
        'Retry-After': {
          schema: { type: 'integer', minimum: 1, maximum: 86400 },
          description:
            'Only when RATE_LIMITED (429) provides a validated hint.',
        },
      },
      content: { 'application/json': { schema: ref('Error') } },
    };
    const authentication = auth(route.path, route.method);
    const label = routeLabelFor(route.path, route.method);
    if (label === 'unmatched')
      throw new Error(`Unlabelled public route: ${id}`);
    const metadata = {
      method: route.method,
      path,
      authentication,
      replay,
      contentType,
    };
    operations[id] = metadata;
    const operation: Schema = {
      operationId: id,
      parameters,
      responses,
      security:
        authentication === 'bearer'
          ? [{ bearerAuth: [] }]
          : authentication === 'optional-bearer'
            ? [{}, { bearerAuth: [] }]
            : authentication === 'first-party-session'
              ? [{ firstPartySession: [] }]
              : [],
      'x-authentication': authentication,
      'x-rate-limit': rate(route.path, route.method),
      'x-replay': replay,
      'x-route-label': label,
      'x-permission-policy':
        'docs/API-OPERATIONS.md; current object/project authorization on every attempt; private invisibility and assurance remain enforced',
      'x-cache-policy':
        route.path === '/api/v1/instance'
          ? 'Anonymous GET: public max-age=60 with Vary Origin, Authorization, Cookie; otherwise no-store'
          : 'no-store',
      ...(body
        ? {
            requestBody: {
              required: true,
              content: { [contentType]: { schema: schemaRef(body) } },
            },
          }
        : {}),
    };
    (paths[path] ??= {})[route.method.toLowerCase()] = operation;
    const successful = Object.entries(declared)
      .filter(([status]) => Number(status) < 300)
      .map(([status, schema]) =>
        status === '204' ? 'undefined' : schemaType(schema),
      );
    types.push(
      `${JSON.stringify(id)}: { params: ${
        parameters.filter((p) => p.in === 'path').length
          ? '{' +
            parameters
              .filter((p) => p.in === 'path')
              .map((p) => `${JSON.stringify(p.name)}: string`)
              .join(';') +
            '}'
          : '{}'
      }; query: ${query ? schemaType(query) : 'Record<string, never>'}; body: ${body ? schemaType(body) : 'undefined'}; response: ${successful.length ? successful.join(' | ') : 'undefined'} };`,
    );
  }
  paths['/attachments/{attachmentId}'] = Object.fromEntries(
    ['get', 'head'].map((method) => [
      method,
      {
        operationId: method.toUpperCase() + ' /attachments/{attachmentId}',
        servers: [
          {
            url: 'https://media.example.com',
            description: 'Separate explicitly configured isolated media origin',
          },
        ],
        parameters: [
          {
            name: 'attachmentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'Range',
            in: 'header',
            required: false,
            schema: { type: 'string' },
            description:
              'One bounded byte range; malformed/unsatisfiable range gives 416.',
          },
        ],
        security: [{}, { bearerAuth: [] }],
        'x-authentication':
          'optional-bearer; private files require current Staff/project/parent authorization and clean released identity',
        'x-rate-limit':
          'bounded range/stream, current authorization before and after object acquisition',
        'x-route-label': 'attachment.media',
        responses: {
          200: {
            description:
              'Authorized download; forced Content-Disposition attachment, no-store, nosniff',
            ...(method === 'get'
              ? {
                  content: {
                    'application/octet-stream': {
                      schema: { type: 'string', format: 'binary' },
                    },
                  },
                }
              : {}),
          },
          206: { description: 'Authorized partial content' },
          default: {
            description:
              'Closed media error (including 416/503); no object key, scan metadata or private download URL',
            content: { 'application/json': { schema: ref('Error') } },
          },
        },
      },
    ]),
  );
  return {
    document: {
      openapi: '3.1.0',
      info: {
        title: 'HyperBug public API',
        version: '1.0.0',
        description:
          'MVP contract; optional services fail closed when unconfigured. Cookie auth pages are protocol operations, not cookie credentials for the business API.',
      },
      servers: [
        {
          url: 'https://api.example.com',
          description: 'Replace with the independently hosted API origin',
        },
      ],
      paths,
      'x-error-catalog': Object.fromEntries(
        Object.entries(failures).map(([code, [status, message]]) => [
          code,
          { status, message },
        ]),
      ),
      'x-cors':
        'Exact configured origins; no credentialed business API requests; explicit global OPTIONS; no-origin clients permitted. API-CONVENTIONS owns allowlisted headers/methods.',
      components: {
        schemas: Object.fromEntries(
          Object.entries(schemas).map(([name, schema]) => [
            name,
            portable(schema),
          ]),
        ),
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'opaque at_ token',
          },
          firstPartySession: {
            type: 'apiKey',
            in: 'cookie',
            name: '__Host-hb_session',
            description:
              'Authorization origin only; same-origin mutations require Origin/Fetch Metadata. Never business API credentials.',
          },
        },
      },
    },
    source: execFileSync(
      'node_modules/.bin/oxfmt',
      ['--stdin-filepath', 'packages/api-client/src/operations.ts'],
      {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        input: `// Generated by tooling/public-api.ts. Do not edit.\nexport const operations = ${JSON.stringify(operations, null, 2)} as const;\nexport interface OperationTypes {\n${types.join('\n')}\n}\n${Object.entries(
          schemas,
        )
          .filter(([, schema]) => typeof schema.$id === 'string')
          .map(([name, schema]) => `type ${name} = ${schemaType(schema)};`)
          .join('\n')}\n`,
      },
    ),
  };
}

function schemaType(schema: Schema): string {
  if (schema.$ref) {
    const name = referenceIds.get(String(schema.$ref));
    if (!name) throw new Error('Unknown generated type reference');
    return name;
  }
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum)
    return (schema.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
  if (schema.anyOf || schema.oneOf)
    return (
      '(' +
      ((schema.anyOf ?? schema.oneOf) as Schema[]).map(schemaType).join(' | ') +
      ')'
    );
  if (Array.isArray(schema.type))
    return schema.type
      .map((type) => schemaType({ ...schema, type }))
      .join(' | ');
  if (schema.type === 'null') return 'null';
  if (schema.type === 'string') return 'string';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array')
    return `Array<${schemaType(schema.items as Schema)}>`;
  if (schema.type === 'object') {
    const fields = Object.entries((schema.properties ?? {}) as Schema).map(
      ([key, value]) =>
        `${JSON.stringify(key)}${(schema.required as string[] | undefined)?.includes(key) ? '' : '?'}: ${schemaType(value as Schema)}`,
    );
    const patterns = Object.values(
      (schema.patternProperties ?? {}) as Schema,
    ) as Schema[];
    if (!fields.length && patterns.length)
      return `Record<string, ${patterns.map(schemaType).join(' | ')}>`;
    if (schema.additionalProperties === true)
      fields.push('[key: string]: unknown');
    return '{' + fields.join(';') + '}';
  }
  return 'unknown';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const generated = generatePublicApi();
  const files = {
    'packages/contracts/openapi.json': execFileSync(
      'node_modules/.bin/oxfmt',
      ['--stdin-filepath', 'packages/contracts/openapi.json'],
      {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        input: JSON.stringify(generated.document, null, 2) + '\n',
      },
    ),
    'packages/api-client/src/operations.ts': generated.source,
  };
  for (const [path, source] of Object.entries(files)) {
    if (process.argv.includes('--check')) {
      if (readFileSync(path, 'utf8') !== source)
        throw new Error(`Public API drift: ${path}`);
    } else writeFileSync(path, source);
  }
  console.log(
    `Public API: ${Object.keys(generated.document.paths).length} paths checked/generated.`,
  );
}
