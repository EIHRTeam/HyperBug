import { definePlugin } from '@hyperbug/plugin-sdk';

/**
 * The failing/slow plugin fixture (05.2f): a security-critical CAPTCHA point
 * whose handler either throws or stalls past the deadline, proving fail-closed
 * behavior — the protected operation is denied, never silently unverified.
 */
export const failingCaptchaPlugin = definePlugin({
  id: '@acme/failing-captcha',
  version: '1.0.0',
  trustTier: 'trusted-native',
  apiVersion: '^1.0.0',
  capabilities: ['captcha'],
  extensionPoints: ['captcha:verify-required'],
  permissions: [],
  settings: [],
});

export const throwingCaptchaHook = (): never => {
  throw new Error('provider exploded');
};

export const slowCaptchaHook = async (): Promise<unknown> => {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  return { verified: true };
};
