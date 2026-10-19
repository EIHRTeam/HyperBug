import { t, type AnyElysia } from 'elysia';
import type { BoundaryHeaders } from './index.ts';
import {
  PluginListSchema,
  PluginRecordSchema,
  PluginSummarySchema,
  type PluginList,
  type PluginRecord,
  type PluginSummary,
} from '@hyperbug/contracts';
import {
  configurePlugin,
  disablePlugin,
  enablePlugin,
  listPlugins,
  loadPlugin,
  readConfiguration,
  registerPlugin,
  uninstallPlugin,
  upgradePlugin,
  type PluginManagementContext,
} from './plugin-management.ts';
export interface PluginsDependencies {
  readonly pluginManagement: PluginManagementContext;
  readonly boundaryFor: (request: Request) => BoundaryHeaders;
  readonly pluginIdBody: (body: { id: string }) => string;
  readonly pluginIdBodySchema: ReturnType<typeof t.Object>;
}
export function pluginsRoutes(
  app: AnyElysia,
  dependencies: PluginsDependencies,
) {
  const { pluginManagement, boundaryFor, pluginIdBody, pluginIdBodySchema } =
    dependencies;
  return app
    .get(
      '/api/v1/admin/plugins',
      async ({ request }): Promise<PluginList> => ({
        plugins: await listPlugins(request, pluginManagement),
      }),
      { response: t.Unsafe<PluginList>(PluginListSchema) },
    )
    .post(
      '/api/v1/admin/plugins',
      async ({ request, body, set }): Promise<PluginSummary> => {
        const summary = await registerPlugin(
          request,
          pluginManagement,
          body.manifest,
          boundaryFor(request).requestId,
        );
        set.status = 201;
        return summary;
      },
      {
        body: t.Object(
          { manifest: t.Object({}, { additionalProperties: true }) },
          { additionalProperties: false },
        ),
        response: { 201: t.Unsafe<PluginSummary>(PluginSummarySchema) },
      },
    )
    .post(
      '/api/v1/admin/plugins/load',
      async ({ request, body }): Promise<PluginRecord> =>
        loadPlugin(request, pluginManagement, pluginIdBody(body)),
      {
        body: pluginIdBodySchema,
        response: t.Unsafe<PluginRecord>(PluginRecordSchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/configure',
      async ({ request, body }): Promise<PluginSummary> =>
        configurePlugin(
          request,
          pluginManagement,
          pluginIdBody(body),
          {
            values: body.values,
            secrets: body.secrets,
          },
          boundaryFor(request).requestId,
        ),
      {
        body: t.Object(
          {
            id: t.String({ minLength: 3, maxLength: 128 }),
            values: t.Optional(
              t.Record(
                t.String(),
                t.Union([t.String(), t.Number(), t.Boolean()]),
              ),
            ),
            secrets: t.Optional(t.Record(t.String(), t.String())),
          },
          { additionalProperties: false },
        ),
        response: t.Unsafe<PluginSummary>(PluginSummarySchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/configuration',
      async ({ request, body }) => ({
        settings: await readConfiguration(
          request,
          pluginManagement,
          pluginIdBody(body),
        ),
      }),
      {
        body: pluginIdBodySchema,
        response: t.Object(
          {
            settings: t.Array(
              t.Object(
                {
                  key: t.String(),
                  kind: t.Union([t.Literal('public'), t.Literal('secret')]),
                  value: t.Optional(
                    t.Union([t.String(), t.Number(), t.Boolean()]),
                  ),
                  secretPresent: t.Optional(t.Boolean()),
                },
                { additionalProperties: false },
              ),
            ),
          },
          { additionalProperties: false },
        ),
      },
    )
    .post(
      '/api/v1/admin/plugins/enable',
      async ({ request, body }): Promise<PluginSummary> =>
        enablePlugin(
          request,
          pluginManagement,
          pluginIdBody(body),
          boundaryFor(request).requestId,
        ),
      {
        body: pluginIdBodySchema,
        response: t.Unsafe<PluginSummary>(PluginSummarySchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/disable',
      async ({ request, body }): Promise<PluginSummary> =>
        disablePlugin(
          request,
          pluginManagement,
          pluginIdBody(body),
          boundaryFor(request).requestId,
        ),
      {
        body: pluginIdBodySchema,
        response: t.Unsafe<PluginSummary>(PluginSummarySchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/upgrade',
      async ({ request, body }): Promise<PluginSummary> =>
        upgradePlugin(
          request,
          pluginManagement,
          body.id,
          body.manifest,
          boundaryFor(request).requestId,
        ),
      {
        body: t.Object(
          {
            id: t.String({ minLength: 3, maxLength: 128 }),
            manifest: t.Object({}, { additionalProperties: true }),
          },
          { additionalProperties: false },
        ),
        response: t.Unsafe<PluginSummary>(PluginSummarySchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/uninstall',
      async ({ request, body, set }) => {
        await uninstallPlugin(
          request,
          pluginManagement,
          body.id,
          body.policy,
          boundaryFor(request).requestId,
        );
        set.status = 204;
        return null;
      },
      {
        body: t.Object(
          {
            id: t.String({ minLength: 3, maxLength: 128 }),
            policy: t.Union([t.Literal('retain'), t.Literal('delete')]),
          },
          { additionalProperties: false },
        ),
        response: { 204: t.Null() },
      },
    );
}
