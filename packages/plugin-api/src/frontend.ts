// Build-time frontend extension descriptors and reviewed CSP merging
// (PLUGIN-SPEC §14; ARCHITECTURE §36; SECURITY §§120, 123). The frontend is a
// static application: plugins integrate at build time only, nothing loads
// remote JavaScript at runtime, and a plugin never edits the CSP itself —
// Core's build process merges manifest-declared origins into the baseline.
import { Type, type Static } from '@sinclair/typebox';

import { PluginCspOriginsSchema, type PluginManifest } from './manifest.ts';

/** One plugin's build-time frontend descriptor (the §13 `ui:build-time-descriptor` payload). */
export const PluginUiDescriptorSchema = Type.Object(
  {
    pluginId: Type.String({
      pattern: '^@[a-z0-9][a-z0-9-]{0,62}/[a-z0-9][a-z0-9-]{0,62}$',
    }),
    /** Manifest-declared CSP origins, already https-exact by schema. */
    csp: PluginCspOriginsSchema,
    /** Declared extension points the descriptor participates in. */
    extensionPoints: Type.Array(Type.String({ minLength: 3, maxLength: 128 }), {
      maxItems: 32,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);
export type PluginUiDescriptor = Static<typeof PluginUiDescriptorSchema>;

/** The four mergeable CSP directives (SECURITY §123). */
export interface CspOriginDirectiveSet {
  readonly scriptOrigins: readonly string[];
  readonly frameOrigins: readonly string[];
  readonly connectOrigins: readonly string[];
  readonly imageOrigins: readonly string[];
}

export const CSP_ORIGIN_DIRECTIVE_LIMIT = 8;

/**
 * Merge manifest-declared origins into a baseline (PLUGIN-SPEC §14.2). Rules:
 * only https exact origins (the manifest schema already rejects wildcards,
 * paths and plain http), at most eight merged entries per directive, the
 * Core baseline is preserved verbatim and always wins ordering, duplicates
 * collapse, and the merge never adds, weakens or rewrites baseline entries —
 * `unsafe-eval`, `unsafe-inline` or `*` are structurally impossible because
 * they are not https origins. A zero-plugin merge returns the baseline.
 */
export function mergeCspOrigins(
  baseline: CspOriginDirectiveSet,
  plugins: readonly Pick<PluginManifest, 'id' | 'csp'>[],
): CspOriginDirectiveSet {
  const isOrigin = (value: string): boolean =>
    /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
      value,
    );
  const merge = (
    base: readonly string[],
    additions: readonly string[],
  ): readonly string[] => {
    const merged = [...base];
    for (const origin of additions) {
      if (!isOrigin(origin)) continue;
      if (
        !merged.includes(origin) &&
        merged.length < CSP_ORIGIN_DIRECTIVE_LIMIT + base.length
      )
        merged.push(origin);
    }
    return merged;
  };
  return {
    scriptOrigins: merge(
      baseline.scriptOrigins,
      plugins.flatMap((plugin) => plugin.csp?.scriptOrigins ?? []),
    ),
    frameOrigins: merge(
      baseline.frameOrigins,
      plugins.flatMap((plugin) => plugin.csp?.frameOrigins ?? []),
    ),
    connectOrigins: merge(
      baseline.connectOrigins,
      plugins.flatMap((plugin) => plugin.csp?.connectOrigins ?? []),
    ),
    imageOrigins: merge(
      baseline.imageOrigins,
      plugins.flatMap((plugin) => plugin.csp?.imageOrigins ?? []),
    ),
  };
}
