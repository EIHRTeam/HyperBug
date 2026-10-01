import { describe, expect, it } from 'vitest';
import {
  invokePluginHook,
  validatePluginModule,
  type PluginHookModule,
} from '@hyperbug/plugin-runtime';
import { definePlugin } from '@hyperbug/plugin-sdk';
import {
  exampleNotifierHooks,
  exampleNotifierPlugin,
} from '../fixtures/plugins/example-notifier.ts';
import {
  failingCaptchaPlugin,
  slowCaptchaHook,
  throwingCaptchaHook,
} from '../fixtures/plugins/failing-slow.ts';

// 05.2f: the example plugin and the failing/slow fixture use only the public
// SDK, and the runtime's bounded executor enforces §11 — fail-closed on the
// security-critical CAPTCHA point whether the handler throws or stalls.
const notifierModule: PluginHookModule = {
  manifest: exampleNotifierPlugin,
  hooks: exampleNotifierHooks,
};

const metadataPlugin = definePlugin({
  id: '@acme/metadata',
  version: '1.0.0',
  trustTier: 'trusted-native',
  apiVersion: '^1.0.0',
  capabilities: ['issue-metadata'],
  extensionPoints: ['issue-metadata:validate'],
  permissions: [],
  settings: [],
});

describe('module validation', () => {
  it('accepts the SDK-authored example plugins', () => {
    expect(validatePluginModule(notifierModule).ok).toBe(true);
    const captcha: PluginHookModule = {
      manifest: failingCaptchaPlugin,
      hooks: { 'captcha:verify-required': throwingCaptchaHook },
    };
    expect(validatePluginModule(captcha).ok).toBe(true);
  });

  it('rejects external modules and undeclared points', () => {
    const external = validatePluginModule({
      manifest: { ...failingCaptchaPlugin, trustTier: 'isolated-external' },
      hooks: {},
    });
    expect(external.ok).toBe(false);
    const undeclared = validatePluginModule({
      manifest: metadataPlugin,
      hooks: { 'captcha:verify-required': throwingCaptchaHook },
    });
    expect(undeclared.ok).toBe(false);
  });
});

describe('bounded sync execution (§11)', () => {
  it('delivers the envelope to an enabled plugin at a sync point', async () => {
    const invocation = await invokePluginHook({
      module: {
        manifest: metadataPlugin,
        hooks: {
          'issue-metadata:validate': (envelope) => ({
            validated: true,
            fields: Object.keys(envelope.payload as object),
          }),
        },
      },
      point: 'issue-metadata:validate',
      state: 'enabled',
      payload: { priority: 'high' },
      nowMs: Date.now(),
      deadlineMs: 500,
    });
    expect(invocation).toEqual({
      action: 'continue',
      result: { validated: true, fields: ['priority'] },
    });
  });

  it('never invokes a disabled or unregistered plugin (§10.4)', async () => {
    let called = false;
    const invocation = await invokePluginHook({
      module: {
        manifest: metadataPlugin,
        hooks: {
          'issue-metadata:validate': () => {
            called = true;
          },
        },
      },
      point: 'issue-metadata:validate',
      state: 'disabled',
      payload: {},
      nowMs: Date.now(),
      deadlineMs: 500,
    });
    expect(called).toBe(false);
    expect(invocation).toMatchObject({ action: 'disabled', error: 'disabled' });
  });

  it('denies when a security-critical handler throws (fail-closed, 03.3f)', async () => {
    const invocation = await invokePluginHook({
      module: {
        manifest: failingCaptchaPlugin,
        hooks: { 'captcha:verify-required': throwingCaptchaHook },
      },
      point: 'captcha:verify-required',
      state: 'enabled',
      payload: { token: 'x' },
      nowMs: Date.now(),
      deadlineMs: 500,
    });
    expect(invocation).toEqual({ action: 'deny', error: 'error' });
  });

  it('denies when a security-critical handler stalls past the deadline', async () => {
    const invocation = await invokePluginHook({
      module: {
        manifest: failingCaptchaPlugin,
        hooks: { 'captcha:verify-required': slowCaptchaHook },
      },
      point: 'captcha:verify-required',
      state: 'enabled',
      payload: { token: 'x' },
      nowMs: Date.now(),
      deadlineMs: 5,
      // Injected fast timer stands in for the wall clock without waiting.
      timer: () =>
        new Promise<never>((_, reject) => setTimeout(reject, 5) as never),
    });
    expect(invocation).toEqual({ action: 'deny', error: 'error' });
  });

  it('rejects async points and invalid deadlines before any handler runs', async () => {
    let called = false;
    const hooks = {
      'notifications:deliver': () => {
        called = true;
      },
    };
    const asyncPoint = await invokePluginHook({
      module: { manifest: exampleNotifierPlugin, hooks },
      point: 'notifications:deliver',
      state: 'enabled',
      payload: {},
      nowMs: Date.now(),
      deadlineMs: 500,
    });
    expect(asyncPoint).toEqual({ action: 'fail-request', error: 'invalid' });
    const badDeadline = await invokePluginHook({
      module: {
        manifest: metadataPlugin,
        hooks: { 'issue-metadata:validate': hooks['notifications:deliver'] },
      },
      point: 'issue-metadata:validate',
      state: 'enabled',
      payload: {},
      nowMs: Date.now(),
      deadlineMs: 9999,
    });
    expect(badDeadline).toEqual({ action: 'fail-request', error: 'invalid' });
    expect(called).toBe(false);
  });
});
