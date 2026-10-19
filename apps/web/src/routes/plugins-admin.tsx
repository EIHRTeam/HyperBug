import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../app.tsx';
import { useProductApi, useProductQuery } from '../product-api.ts';
import { CommandForm } from '../components/command-form.tsx';
import { QueryStatus } from '../components/product.tsx';
import { productError } from '../product-state.ts';

function PluginSettings({ id }: { id: string }) {
  const api = useProductApi();
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<
    {
      key: string;
      kind: 'public' | 'secret';
      value?: string | number | boolean;
      secretPresent?: boolean;
    }[]
  >();
  const [disclosure, setDisclosure] = useState('');
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            const [configuration, loaded] = await Promise.all([
              api.request('POST /api/v1/admin/plugins/configuration', {
                body: { id },
              }),
              api.request('POST /api/v1/admin/plugins/load', { body: { id } }),
            ]);
            // Configuration lists only stored rows; include each manifest declaration
            // so an unset setting can be configured. Never copy secret values/defaults.
            if (!Array.isArray(loaded.manifest.settings))
              throw new Error('INVALID_MANIFEST');
            const stored = new Map(
              configuration.settings.map((setting) => [setting.key, setting]),
            );
            setSettings(
              loaded.manifest.settings.map((declaration: unknown) => {
                if (
                  !declaration ||
                  typeof declaration !== 'object' ||
                  !('key' in declaration) ||
                  typeof declaration.key !== 'string' ||
                  !('kind' in declaration)
                )
                  throw new Error('INVALID_MANIFEST');
                const setting = stored.get(declaration.key);
                if (declaration.kind === 'secret')
                  return {
                    key: declaration.key,
                    kind: 'secret' as const,
                    secretPresent:
                      setting?.kind === 'secret' &&
                      Boolean(setting.secretPresent),
                  };
                if (declaration.kind !== 'public')
                  throw new Error('INVALID_MANIFEST');
                const defaultValue =
                  'defaultValue' in declaration
                    ? declaration.defaultValue
                    : undefined;
                const value =
                  setting?.kind === 'public' ? setting.value : defaultValue;
                return {
                  key: declaration.key,
                  kind: 'public' as const,
                  ...(['string', 'number', 'boolean'].includes(typeof value)
                    ? { value: value as string | number | boolean }
                    : {}),
                };
              }),
            );
            setDisclosure(
              JSON.stringify(
                {
                  trustTier: loaded.manifest.trustTier,
                  csp: loaded.manifest.csp ?? {},
                },
                null,
                2,
              ),
            );
          } catch (error) {
            setMessage(productError(error));
          }
        }}
      >
        Load redacted settings for {id}
      </button>
      {disclosure ? <pre>{disclosure}</pre> : null}
      <output>{message}</output>
      {settings?.map((setting) => (
        <section key={setting.key}>
          <p>
            {setting.key} ·{' '}
            {setting.kind === 'secret'
              ? setting.secretPresent
                ? 'Secret configured (value unavailable)'
                : 'Secret not configured'
              : `Public value: ${String(setting.value ?? '')}`}
          </p>
          <CommandForm
            label={`Save ${id} ${setting.key}`}
            confirm
            fields={[
              {
                name: 'value',
                label:
                  setting.kind === 'secret'
                    ? 'New secret value (write only)'
                    : 'New public value as JSON scalar',
                secret: setting.kind === 'secret',
                required: true,
                maxLength: 8192,
              },
            ]}
            onSave={(value) => {
              if (setting.kind === 'secret')
                return api.request('POST /api/v1/admin/plugins/configure', {
                  body: { id, secrets: { [setting.key]: value.value! } },
                });
              const scalar: unknown = JSON.parse(value.value!);
              if (!['string', 'number', 'boolean'].includes(typeof scalar))
                throw new Error('INVALID_SETTING');
              return api.request('POST /api/v1/admin/plugins/configure', {
                body: {
                  id,
                  values: {
                    [setting.key]: scalar as string | number | boolean,
                  },
                },
              });
            }}
          />
        </section>
      ))}
    </>
  );
}
export function PluginsAdmin() {
  const { state } = useAuth();
  const api = useProductApi();
  const cache = useQueryClient();
  const plugins = useProductQuery(
    'GET /api/v1/admin/plugins',
    {},
    state.account?.kind === 'staff',
  );
  async function changed(work: Promise<unknown>) {
    await work;
    await cache.invalidateQueries({
      queryKey: ['product', api.origin, state.epoch],
    });
  }
  return (
    <>
      <h1>Instance plugins</h1>
      <p>
        Instance Administrator permission and recent authentication are
        required. Installing a native plugin means trusting its code with
        application privileges. Manifest permissions are not a sandbox. Declared
        CSP origins require build-time review; enabling a backend plugin cannot
        load remote JavaScript or change this app’s CSP.
      </p>
      {state.account?.kind === 'staff' ? (
        <>
          <QueryStatus query={plugins} />
          {!plugins.isPending && !plugins.data?.plugins.length ? (
            <p>
              No plugins registered. Core remains usable without optional
              providers.
            </p>
          ) : null}
          {plugins.data?.plugins.map((plugin) => (
            <section key={plugin.id}>
              <h2>
                {plugin.id} · {plugin.version}
              </h2>
              <p>
                Status: {plugin.state}. Disabled plugins do not provide their
                optional capabilities.
              </p>
              <PluginSettings id={plugin.id} />
              <CommandForm
                key={plugin.state}
                label={`${plugin.state === 'enabled' ? 'Disable' : 'Enable'} ${plugin.id}`}
                confirm
                fields={[]}
                onSave={() =>
                  changed(
                    plugin.state === 'enabled'
                      ? api.request('POST /api/v1/admin/plugins/disable', {
                          body: { id: plugin.id },
                        })
                      : api.request('POST /api/v1/admin/plugins/enable', {
                          body: { id: plugin.id },
                        }),
                  )
                }
              />
            </section>
          ))}
        </>
      ) : (
        <p>
          Sign in with your Staff identity to access instance administration.
        </p>
      )}
    </>
  );
}
