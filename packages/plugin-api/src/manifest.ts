// Manifest schemas and compatibility helpers (PLUGIN-SPEC §9). The manifest
// is the single declaration a plugin makes about itself: identity, version,
// required Plugin API range, capabilities, extension points, permissions,
// settings and CSP origins. Everything here is pure schema plus pure helpers
// so the SDK (author side) and the runtime (host side) validate identically.
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

import { PLUGIN_TRUST_TIERS } from './identity.ts';

/** Exact semver, prerelease allowed, build metadata excluded (PLUGIN-SPEC §9.1). */
export const SEMVER_PATTERN = '^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z-]+)?$';

/**
 * Plugin API compatibility range: an exact version or a caret/tilde range
 * (PLUGIN-SPEC §9.2). The full semver-range grammar is deliberately out of
 * scope; hosts and authors share one small rule set.
 */
export const API_VERSION_RANGE_PATTERN =
  '^(\\^|~)?\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z-]+)?$';

/** Scoped plugin id: `@vendor/name`, lowercase kebab segments (PLUGIN-SPEC §9.1). */
export const PLUGIN_ID_PATTERN =
  '^@[a-z0-9][a-z0-9-]{0,62}/[a-z0-9][a-z0-9-]{0,62}$';

/** Setting keys are flat lowercase kebab names inside the plugin's namespace. */
export const SETTING_KEY_PATTERN = '^[a-z][a-z0-9-]{0,63}$';

/** Extension point reference: `capability:point-id` (PLUGIN-SPEC §9.3). */
export const EXTENSION_POINT_PATTERN =
  '^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)?:[a-z0-9][a-z0-9-]*$';

/** CSP origins are https origins without path or wildcard (PLUGIN-SPEC §9.6). */
export const HTTPS_ORIGIN_PATTERN =
  '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$';

/**
 * Capability vocabulary (PRODUCT §25). A capability names an extension
 * surface; the concrete contracts per capability are defined by module 05.2c.
 */
export const PLUGIN_CAPABILITIES = [
  'authentication',
  'sso',
  'captcha',
  'notifications',
  'issue-actions',
  'issue-metadata',
  'integrations',
  'import',
  'export',
  'search',
  'settings.admin',
  'settings.project',
  'ui',
] as const;

export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number];

/**
 * Permission vocabulary (SECURITY §38 least privilege). For native plugins
 * these are review and disclosure metadata, not a sandbox (PLUGIN-SPEC §3.2);
 * for external plugins they scope capability APIs. Module 05.2c binds each
 * permission to the capability APIs that actually check it.
 */
export const PLUGIN_PERMISSIONS = [
  'data:read',
  'data:write',
  'secrets:read',
  'events:publish',
  'events:subscribe',
  'network:fetch',
  'ui:extend',
] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

const capabilitySchema = Type.Union(
  PLUGIN_CAPABILITIES.map((capability) => Type.Literal(capability)),
);
const permissionSchema = Type.Union(
  PLUGIN_PERMISSIONS.map((permission) => Type.Literal(permission)),
);
const trustTierSchema = Type.Union(
  PLUGIN_TRUST_TIERS.map((tier) => Type.Literal(tier)),
);

/**
 * Public setting: readable back through configuration reads (PLUGIN-SPEC
 * §9.5). A default is allowed because the value is not a credential.
 */
export const PublicPluginSettingSchema = Type.Object(
  {
    key: Type.String({ pattern: SETTING_KEY_PATTERN }),
    kind: Type.Literal('public'),
    valueType: Type.Union([
      Type.Literal('string'),
      Type.Literal('number'),
      Type.Literal('boolean'),
    ]),
    defaultValue: Type.Optional(
      Type.Union([Type.String(), Type.Number(), Type.Boolean()]),
    ),
    description: Type.Optional(Type.String({ maxLength: 280 })),
  },
  { additionalProperties: false },
);

/**
 * Secret setting (SECURITY §121): write-only, never returned in plaintext by
 * read APIs, and it must not carry a default — `additionalProperties: false`
 * rejects `defaultValue` and `valueType` outright.
 */
export const SecretPluginSettingSchema = Type.Object(
  {
    key: Type.String({ pattern: SETTING_KEY_PATTERN }),
    kind: Type.Literal('secret'),
    description: Type.Optional(Type.String({ maxLength: 280 })),
  },
  { additionalProperties: false },
);

export const PluginSettingSchema = Type.Union([
  PublicPluginSettingSchema,
  SecretPluginSettingSchema,
]);
export type PluginSetting = Static<typeof PluginSettingSchema>;

/** Declared CSP origins (SECURITY §123); Core's build process reviews and merges them. */
export const PluginCspOriginsSchema = Type.Object(
  {
    scriptOrigins: Type.Array(Type.String({ pattern: HTTPS_ORIGIN_PATTERN }), {
      maxItems: 8,
      uniqueItems: true,
    }),
    frameOrigins: Type.Array(Type.String({ pattern: HTTPS_ORIGIN_PATTERN }), {
      maxItems: 8,
      uniqueItems: true,
    }),
    connectOrigins: Type.Array(Type.String({ pattern: HTTPS_ORIGIN_PATTERN }), {
      maxItems: 8,
      uniqueItems: true,
    }),
    imageOrigins: Type.Array(Type.String({ pattern: HTTPS_ORIGIN_PATTERN }), {
      maxItems: 8,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);
export type PluginCspOrigins = Static<typeof PluginCspOriginsSchema>;

export const PluginManifestSchema = Type.Object(
  {
    id: Type.String({ pattern: PLUGIN_ID_PATTERN }),
    version: Type.String({ pattern: SEMVER_PATTERN }),
    trustTier: trustTierSchema,
    apiVersion: Type.String({ pattern: API_VERSION_RANGE_PATTERN }),
    capabilities: Type.Array(capabilitySchema, {
      minItems: 1,
      maxItems: PLUGIN_CAPABILITIES.length,
      uniqueItems: true,
    }),
    extensionPoints: Type.Array(
      Type.String({ pattern: EXTENSION_POINT_PATTERN }),
      { maxItems: 32, uniqueItems: true },
    ),
    permissions: Type.Array(permissionSchema, {
      maxItems: PLUGIN_PERMISSIONS.length,
      uniqueItems: true,
    }),
    settings: Type.Array(PluginSettingSchema, {
      maxItems: 32,
      uniqueItems: true,
    }),
    csp: Type.Optional(PluginCspOriginsSchema),
    displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
    description: Type.Optional(Type.String({ maxLength: 280 })),
  },
  { additionalProperties: false },
);
export type PluginManifest = Static<typeof PluginManifestSchema>;

/** Manifest validation outcome with human-readable errors for registration and authoring. */
export type ManifestValidation =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: string[] };

/**
 * Validate a manifest: schema-level checks plus the semantic rules the schema
 * cannot express — every extension point's capability prefix must be declared
 * in `capabilities`, and the list fields must not contain duplicates
 * (TypeBox 0.34 does not enforce `uniqueItems` on these arrays).
 */
export function validatePluginManifest(input: unknown): ManifestValidation {
  if (!Value.Check(PluginManifestSchema, input)) {
    const errors = [...Value.Errors(PluginManifestSchema, input)].map(
      (error) => `${error.path || '/'} ${error.message}`,
    );
    return {
      ok: false,
      errors: errors.length ? errors : ['manifest is invalid'],
    };
  }
  const manifest = input as PluginManifest;
  const errors: string[] = [];
  const duplicates = (field: string, values: readonly string[]) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) errors.push(`/${field} duplicate entry '${value}'`);
      seen.add(value);
    }
  };
  duplicates('capabilities', manifest.capabilities);
  duplicates('extensionPoints', manifest.extensionPoints);
  duplicates('permissions', manifest.permissions);
  duplicates(
    'settings',
    manifest.settings.map((setting) => setting.key),
  );
  if (manifest.csp) {
    duplicates('csp/scriptOrigins', manifest.csp.scriptOrigins);
    duplicates('csp/frameOrigins', manifest.csp.frameOrigins);
    duplicates('csp/connectOrigins', manifest.csp.connectOrigins);
    duplicates('csp/imageOrigins', manifest.csp.imageOrigins);
  }
  for (const point of manifest.extensionPoints) {
    const capability = point.slice(0, point.indexOf(':'));
    if (!manifest.capabilities.includes(capability as PluginCapability))
      errors.push(
        `/extensionPoints ${point} references capability '${capability}' that the manifest does not declare`,
      );
  }
  return errors.length ? { ok: false, errors } : { ok: true, manifest };
}

/**
 * Derive the namespace a plugin owns for data, settings, migrations and
 * events (PLUGIN-SPEC §9.7): `@vendor/name` becomes `plugin_vendor_name`
 * with kebab segments mapped to underscores, so the namespace is a safe
 * unquoted identifier in both SQL dialects. Ids allow hyphens but not
 * underscores, so the mapping cannot collide. Callers must pass an
 * already-validated id.
 */
export function pluginDataNamespace(id: string): string {
  const match = /^@([a-z0-9][a-z0-9-]{0,62})\/([a-z0-9][a-z0-9-]{0,62})$/.exec(
    id,
  );
  const vendor = match?.[1];
  const name = match?.[2];
  if (vendor === undefined || name === undefined)
    throw new TypeError(`not a plugin id: ${id}`);
  return `plugin_${vendor.replaceAll('-', '_')}_${name.replaceAll('-', '_')}`;
}

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | undefined;
}

function parseSemver(version: string): SemverParts | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+))?$/.exec(version);
  if (match === null) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (
    !Number.isSafeInteger(major) ||
    !Number.isSafeInteger(minor) ||
    !Number.isSafeInteger(patch)
  )
    return null;
  return { major, minor, patch, prerelease: match[4] };
}

function comparePrerelease(left: SemverParts, right: SemverParts): number {
  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === undefined) return 1;
  if (right.prerelease === undefined) return -1;
  return left.prerelease < right.prerelease ? -1 : 1;
}

function compareCore(left: SemverParts, right: SemverParts): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

/**
 * Whether `version` satisfies an exact/caret/tilde `range` under PLUGIN-SPEC
 * §9.2's simplified rules: caret stays inside the leftmost non-zero segment
 * (npm semantics), tilde stays inside the minor version, and a prerelease
 * `version` satisfies only a range whose base has the same core version and
 * the same prerelease.
 */
export function apiVersionSatisfies(range: string, version: string): boolean {
  const match = /^([~^]?)(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+)?)$/.exec(range);
  const operator = match?.[1] ?? '';
  const base = match?.[2];
  if (base === undefined) return false;
  const baseParts = parseSemver(base);
  const versionParts = parseSemver(version);
  if (baseParts === null || versionParts === null) return false;

  if (versionParts.prerelease !== undefined) {
    if (versionParts.prerelease !== baseParts.prerelease) return false;
    if (compareCore(versionParts, baseParts) !== 0) return false;
  }
  if (versionParts.major !== baseParts.major) return false;
  if (operator === '')
    return (
      compareCore(versionParts, baseParts) === 0 &&
      comparePrerelease(versionParts, baseParts) === 0
    );
  if (operator === '~')
    return (
      versionParts.minor === baseParts.minor &&
      (compareCore(versionParts, baseParts) >= 0 ||
        comparePrerelease(versionParts, baseParts) === 0)
    );
  // Caret: bounded by the leftmost non-zero segment.
  const sameMinor = versionParts.minor === baseParts.minor;
  const samePatch = versionParts.patch === baseParts.patch;
  if (baseParts.major > 0) return compareCore(versionParts, baseParts) >= 0;
  if (baseParts.minor > 0)
    return sameMinor && compareCore(versionParts, baseParts) >= 0;
  return sameMinor && samePatch && compareCore(versionParts, baseParts) >= 0;
}
