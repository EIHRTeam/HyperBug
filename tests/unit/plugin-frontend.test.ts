import { describe, expect, it } from 'vitest';
import {
  CSP_ORIGIN_DIRECTIVE_LIMIT,
  mergeCspOrigins,
  type CspOriginDirectiveSet,
} from '@hyperbug/plugin-api';

// PLUGIN-SPEC §14: the merge never weakens the baseline, only https exact
// origins enter, and a zero-plugin merge is the identity.
const baseline: CspOriginDirectiveSet = {
  scriptOrigins: ['https://static.example.net'],
  frameOrigins: [],
  connectOrigins: ['https://api.example.net'],
  imageOrigins: [],
};

describe('mergeCspOrigins (§14.2)', () => {
  it('returns the baseline unchanged with zero plugins', () => {
    expect(mergeCspOrigins(baseline, [])).toEqual(baseline);
  });

  it('merges declared https origins, deduplicated', () => {
    const merged = mergeCspOrigins(baseline, [
      {
        id: '@acme/ui',
        csp: {
          scriptOrigins: ['https://cdn.acme.example'],
          frameOrigins: ['https://embed.acme.example'],
          connectOrigins: ['https://api.example.net'],
          imageOrigins: [],
        },
      },
    ]);
    expect(merged.scriptOrigins).toEqual([
      'https://static.example.net',
      'https://cdn.acme.example',
    ]);
    expect(merged.frameOrigins).toEqual(['https://embed.acme.example']);
    expect(merged.connectOrigins).toEqual(['https://api.example.net']);
  });

  it('ignores non-origin values so unsafe additions are structurally impossible', () => {
    const merged = mergeCspOrigins(baseline, [
      {
        id: '@evil/ui',
        csp: {
          scriptOrigins: [
            '*',
            'unsafe-eval',
            'unsafe-inline',
            'http://plain.example',
            'https://a.example/path',
          ],
          frameOrigins: [],
          connectOrigins: [],
          imageOrigins: [],
        },
      },
    ]);
    expect(merged).toEqual(baseline);
  });

  it('bounds merged entries per directive beyond the baseline', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `@acme/ui-${i}`,
      csp: {
        scriptOrigins: [`https://host-${i}.acme.example`],
        frameOrigins: [],
        connectOrigins: [],
        imageOrigins: [],
      },
    }));
    const merged = mergeCspOrigins(baseline, many);
    expect(merged.scriptOrigins).toHaveLength(1 + CSP_ORIGIN_DIRECTIVE_LIMIT);
    expect(merged.scriptOrigins[0]).toBe('https://static.example.net');
  });

  it('never removes or reorders baseline entries', () => {
    const merged = mergeCspOrigins(baseline, [
      {
        id: '@acme/ui',
        csp: {
          scriptOrigins: ['https://cdn.acme.example'],
          frameOrigins: [],
          connectOrigins: ['https://collector.acme.example'],
          imageOrigins: ['https://img.acme.example'],
        },
      },
    ]);
    expect(merged.scriptOrigins.slice(0, 1)).toEqual(baseline.scriptOrigins);
    expect(merged.connectOrigins.slice(0, 1)).toEqual(baseline.connectOrigins);
  });
});
