// External service protocol contract (PLUGIN-SPEC §12). Isolated external
// plugins run outside the Core process and communicate only through the
// channels, grants and signed events defined here. The crypto itself uses the
// platform mechanisms described in docs/CRYPTOGRAPHY.md; this module fixes the
// protocol vocabulary both sides code against.
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

import { PluginHookEnvelopeSchema } from './hooks.ts';
import { PLUGIN_PERMISSIONS } from './manifest.ts';

/** Current signature version over signed event deliveries (PLUGIN-SPEC §12.4). */
export const PLUGIN_EVENT_SIGNATURE_VERSION = 1;

/** Signature algorithm of the current version (HMAC-SHA256 over canonical bytes). */
export const PLUGIN_EVENT_SIGNATURE_ALGORITHM = 'hmac-sha256' as const;

/**
 * Freshness window for accepting a signed event (PLUGIN-SPEC §12.4): outside
 * the window measured from `occurredAt`, delivery is rejected as stale —
 * together with `eventId` deduplication this bounds replay.
 */
export const SIGNED_EVENT_FRESHNESS_WINDOW_MS = 300_000;

/**
 * Channels an external plugin may use (PLUGIN-SPEC §12.2; SECURITY §119):
 * Core's capability API called with a scoped token, Core-pushed signed
 * webhooks, or a private service binding within one deployment.
 */
export const EXTERNAL_PLUGIN_CHANNELS = [
  'capability-api',
  'signed-webhook',
  'service-binding',
] as const;
export type ExternalPluginChannel = (typeof EXTERNAL_PLUGIN_CHANNELS)[number];

/**
 * Metadata of a scoped capability grant issued to an external plugin
 * (PLUGIN-SPEC §12.3). The grant binds a per-plugin opaque token to the
 * declared permissions and a narrow expiry; it is never a Core session and
 * carries no principal identity. Grants are revoked on disable, uninstall,
 * key rotation or suspected compromise.
 */
export const CapabilityGrantSchema = Type.Object(
  {
    pluginId: Type.String({
      pattern: '^@[a-z0-9][a-z0-9-]{0,62}/[a-z0-9][a-z0-9-]{0,62}$',
    }),
    channel: Type.Union(
      EXTERNAL_PLUGIN_CHANNELS.map((channel) => Type.Literal(channel)),
    ),
    permissions: Type.Array(
      Type.Union(
        PLUGIN_PERMISSIONS.map((permission) => Type.Literal(permission)),
      ),
      { maxItems: PLUGIN_PERMISSIONS.length, uniqueItems: true },
    ),
    keyId: Type.String({ minLength: 1, maxLength: 64 }),
    expiresAt: Type.String({
      pattern:
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$',
    }),
  },
  { additionalProperties: false },
);
export type CapabilityGrant = Static<typeof CapabilityGrantSchema>;

/** Validate a capability grant record. */
export function isCapabilityGrant(input: unknown): boolean {
  return Value.Check(CapabilityGrantSchema, input);
}

/**
 * A versioned, signed event delivery to an external plugin (PLUGIN-SPEC
 * §12.4): the §11.5 envelope plus the signature block. HMAC-SHA256 over the
 * canonical envelope bytes with the per-plugin delivery key; `keyId` supports
 * rotation. Hex signature is fixed-length for hmac-sha256.
 */
export const SignedPluginEventSchema = Type.Object(
  {
    envelope: PluginHookEnvelopeSchema,
    signatureVersion: Type.Integer({ minimum: 1 }),
    algorithm: Type.Literal('hmac-sha256'),
    keyId: Type.String({ minLength: 1, maxLength: 64 }),
    signature: Type.String({ pattern: '^[0-9a-f]{64}$' }),
  },
  { additionalProperties: false },
);
export type SignedPluginEvent = Static<typeof SignedPluginEventSchema>;

/** Validate a signed event record structurally (signature verification is the runtime's job). */
export function isSignedPluginEvent(input: unknown): boolean {
  return Value.Check(SignedPluginEventSchema, input);
}

/**
 * Whether a signed event's `occurredAt` falls inside the freshness window
 * relative to `nowMs` (PLUGIN-SPEC §12.4). Stale deliveries are rejected;
 * freshness bounds replay together with eventId deduplication, it does not
 * replace it.
 */
export function isWithinSignedEventFreshness(
  occurredAt: string,
  nowMs: number,
): boolean {
  const occurred = Date.parse(occurredAt);
  if (!Number.isFinite(occurred) || !Number.isFinite(nowMs)) return false;
  return Math.abs(nowMs - occurred) <= SIGNED_EVENT_FRESHNESS_WINDOW_MS;
}
