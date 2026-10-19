import { describe, expect, it } from 'vitest';
import {
  MAX_CONCURRENT_HOOK_INVOCATIONS,
  PLUGIN_HOOK_ERROR_KINDS,
  PLUGIN_HOOK_FAILURE_POLICIES,
  SYNC_HOOK_DEADLINE_CEILING_MS,
  SYNC_HOOK_PAYLOAD_LIMIT_BYTES,
  effectiveFailurePolicy,
  hookFailureAction,
  isPluginHookEnvelope,
  isWithinSyncPayloadLimit,
} from '@hyperbug/plugin-api';

// PLUGIN-SPEC §11: the hook protocol's security property is that
// security-critical points cannot be weakened by a plugin declaration — the
// 03.3f re-scope — and that every policy maps to one explicit runtime action.
const validEnvelope = {
  hook: 'captcha:verify-required',
  eventId: '0f0e7a52-5f1a-4ab8-9c3d-6a1b2c3d4e5f',
  payloadVersion: 1,
  occurredAt: '2026-10-01T12:00:00.000Z',
  pluginId: '@hyperbug/example',
  payload: { token: 'tok' },
};

describe('failure policies (§11.4)', () => {
  it('forces fail-closed on security-critical points regardless of declaration', () => {
    for (const declared of PLUGIN_HOOK_FAILURE_POLICIES)
      expect(effectiveFailurePolicy(true, declared)).toBe('fail-closed');
  });

  it('keeps the plugin-declared policy on non-critical points', () => {
    expect(effectiveFailurePolicy(false, 'enqueue-retry')).toBe(
      'enqueue-retry',
    );
    expect(effectiveFailurePolicy(false, 'continue-without-effect')).toBe(
      'continue-without-effect',
    );
  });

  it('maps every policy and error kind to one explicit action', () => {
    for (const policy of PLUGIN_HOOK_FAILURE_POLICIES)
      for (const error of PLUGIN_HOOK_ERROR_KINDS) {
        const action = hookFailureAction(policy, error);
        expect(action).toEqual(
          {
            'fail-closed': 'deny',
            'fail-request': 'fail-request',
            'enqueue-retry': 'enqueue-retry',
            'continue-without-effect': 'continue',
          }[policy],
        );
      }
  });
});

describe('envelope schema (§11.5)', () => {
  it('accepts a conforming envelope', () => {
    expect(isPluginHookEnvelope(validEnvelope)).toBe(true);
  });

  it('rejects malformed hook names, plugin ids and missing fields', () => {
    expect(
      isPluginHookEnvelope({
        ...validEnvelope,
        hook: 'not-a-point',
      }),
    ).toBe(false);
    expect(
      isPluginHookEnvelope({
        ...validEnvelope,
        pluginId: 'example',
      }),
    ).toBe(false);
    const { eventId: _eventId, ...missingEventId } = validEnvelope;
    expect(isPluginHookEnvelope(missingEventId)).toBe(false);
  });
});

describe('budgets (§11.3)', () => {
  it('fixes the ceiling constants', () => {
    expect(SYNC_HOOK_PAYLOAD_LIMIT_BYTES).toBe(65_536);
    expect(SYNC_HOOK_DEADLINE_CEILING_MS).toBe(3_000);
    expect(MAX_CONCURRENT_HOOK_INVOCATIONS).toBe(8);
  });

  it('bounds serialized sync payloads at the ceiling', () => {
    expect(isWithinSyncPayloadLimit(0)).toBe(true);
    expect(isWithinSyncPayloadLimit(SYNC_HOOK_PAYLOAD_LIMIT_BYTES)).toBe(true);
    expect(isWithinSyncPayloadLimit(SYNC_HOOK_PAYLOAD_LIMIT_BYTES + 1)).toBe(
      false,
    );
    expect(isWithinSyncPayloadLimit(-1)).toBe(false);
  });
});
