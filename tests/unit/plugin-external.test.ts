import { describe, expect, it } from 'vitest';
import {
  EXTERNAL_PLUGIN_CHANNELS,
  PLUGIN_EVENT_SIGNATURE_ALGORITHM,
  PLUGIN_EVENT_SIGNATURE_VERSION,
  SIGNED_EVENT_FRESHNESS_WINDOW_MS,
  isCapabilityGrant,
  isSignedPluginEvent,
  isWithinSignedEventFreshness,
} from '@hyperbug/plugin-api';

// PLUGIN-SPEC §12: the external-service protocol's structural contract. The
// runtime's actual signing and verification are exercised with 05.2/05.3
// fixtures; here the vocabulary and record shapes are pinned.
const envelope = {
  hook: 'notifications:deliver',
  eventId: '0f0e7a52-5f1a-4ab8-9c3d-6a1b2c3d4e5f',
  payloadVersion: 2,
  occurredAt: '2026-10-01T12:00:00.000Z',
  pluginId: '@acme/notify',
  payload: { subject: 'x' },
};

const signedEvent = {
  envelope,
  signatureVersion: 1,
  algorithm: 'hmac-sha256',
  keyId: 'delivery-2026-10',
  signature: 'a'.repeat(64),
};

const grant = {
  pluginId: '@acme/notify',
  channel: 'capability-api',
  permissions: ['data:read', 'events:subscribe'],
  keyId: 'grant-1',
  expiresAt: '2026-10-01T13:00:00.000Z',
};

describe('channels and versions (§12.1, §12.4)', () => {
  it('fixes the channel vocabulary and signature version', () => {
    expect([...EXTERNAL_PLUGIN_CHANNELS]).toEqual([
      'capability-api',
      'signed-webhook',
      'service-binding',
    ]);
    expect(PLUGIN_EVENT_SIGNATURE_VERSION).toBe(1);
    expect(PLUGIN_EVENT_SIGNATURE_ALGORITHM).toBe('hmac-sha256');
    expect(SIGNED_EVENT_FRESHNESS_WINDOW_MS).toBe(300_000);
  });
});

describe('capability grants (§12.2)', () => {
  it('accepts a conforming grant', () => {
    expect(isCapabilityGrant(grant)).toBe(true);
  });

  it('rejects unknown channels, permissions and extra fields', () => {
    expect(isCapabilityGrant({ ...grant, channel: 'direct-sql' })).toBe(false);
    expect(isCapabilityGrant({ ...grant, permissions: ['admin:*'] })).toBe(
      false,
    );
    expect(isCapabilityGrant({ ...grant, principal: 'user-1' })).toBe(false);
  });
});

describe('signed events (§12.4)', () => {
  it('accepts a structurally valid delivery', () => {
    expect(isSignedPluginEvent(signedEvent)).toBe(true);
  });

  it('rejects wrong signature length, unknown algorithm and tampering', () => {
    expect(
      isSignedPluginEvent({ ...signedEvent, signature: 'a'.repeat(63) }),
    ).toBe(false);
    expect(isSignedPluginEvent({ ...signedEvent, algorithm: 'plain' })).toBe(
      false,
    );
    // Structural validation cannot detect a re-signed different pluginId —
    // that is the signature's job — so tampering here must add structure the
    // schema rejects.
    expect(
      isSignedPluginEvent({
        ...signedEvent,
        envelope: { ...envelope, extra: 'field' },
      }),
    ).toBe(false);
  });
});

describe('freshness window (§12.4)', () => {
  const occurredMs = Date.parse('2026-10-01T12:00:00.000Z');

  it('accepts inside the window and rejects stale or malformed input', () => {
    expect(
      isWithinSignedEventFreshness(
        '2026-10-01T12:00:00.000Z',
        occurredMs + SIGNED_EVENT_FRESHNESS_WINDOW_MS,
      ),
    ).toBe(true);
    expect(
      isWithinSignedEventFreshness(
        '2026-10-01T12:00:00.000Z',
        occurredMs + SIGNED_EVENT_FRESHNESS_WINDOW_MS + 1,
      ),
    ).toBe(false);
    expect(isWithinSignedEventFreshness('not-a-date', occurredMs)).toBe(false);
  });
});
