import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { generatePublicApi, publicRoutes } from '../../tooling/public-api.ts';

it('keeps every registered MVP method/schema and the generated client compatible with the published contract', () => {
  const generated = generatePublicApi();
  expect(
    JSON.parse(readFileSync('packages/contracts/openapi.json', 'utf8')),
  ).toEqual(generated.document);
  expect(readFileSync('packages/api-client/src/operations.ts', 'utf8')).toBe(
    generated.source,
  );
  const documented = Object.entries(generated.document.paths).flatMap(
    ([path, methods]) =>
      Object.keys(methods).map((method) => method.toUpperCase() + ' ' + path),
  );
  expect(
    documented.filter((id) => !id.includes('/attachments/')).sort(),
  ).toEqual(
    publicRoutes()
      .filter((r) => !r.path.startsWith('/_proof'))
      .map(
        (r) =>
          r.method + ' ' + r.path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, '{$1}'),
      )
      .sort(),
  );
  const components = generated.document.components.schemas;
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref')
        expect(components).toHaveProperty(
          String(child).replace('#/components/schemas/', ''),
        );
      else walk(child);
    }
  };
  walk(generated.document);
  expect(components.InstanceDocument?.properties).toHaveProperty(
    'search.properties.textScope',
  );
  const manifest = JSON.parse(
    readFileSync('packages/api-client/package.json', 'utf8'),
  );
  expect(Object.keys(manifest.dependencies)).toEqual(['@hyperbug/contracts']);
});
