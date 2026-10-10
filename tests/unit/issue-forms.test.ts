import { expect, it } from 'vitest';
import { decodeIssueFormYaml } from '../../packages/security/src/issue-form-yaml.ts';
import {
  normalizeIssueFormDefinition,
  validateIssueFormAnswers,
  IssueFormError,
  issueFormStorageCharacters,
} from '@hyperbug/application';
import { nearLimitIssueFormDefinition } from '../fixtures/content-storage-bound.ts';
import {
  issueFormCorpusResults,
  completeIssueFormYaml,
  validFormAnswers,
} from '../fixtures/issue-form-corpus.ts';
import { deriveMarkdownTree } from '../../packages/security/src/markdown/index.ts';

it('bounds the normalized storage envelope for both JSON dialects', () => {
  const definition = normalizeIssueFormDefinition(
    nearLimitIssueFormDefinition(),
    'canonical',
  );
  expect(issueFormStorageCharacters(definition)).toBe(65536);
  expect(
    new TextEncoder().encode(JSON.stringify(definition)).length,
  ).toBeLessThan(65536);
  expect(() =>
    normalizeIssueFormDefinition(nearLimitIssueFormDefinition(1), 'canonical'),
  ).toThrow(IssueFormError);
});

it('normalizes all six GitHub field types and attributes; rejects malformed YAML and answers', () => {
  const result = issueFormCorpusResults();
  expect(result.definition.body.map((v) => v.type)).toEqual([
    'markdown',
    'input',
    'textarea',
    'dropdown',
    'dropdown',
    'checkboxes',
    'upload',
  ]);
  expect(result.definition.labels).toEqual(['bug', 'triage']);
  expect(result.definition.assignees).toEqual(['maintainer']);
  expect(result.revalidated).toEqual(result.definition);
  expect(result.minimal.body[0]?.id).toBe('field-1');
  expect(result.rejectedYaml).not.toContain('accepted');
  expect(
    result.rejectedAnswers.every((code) => code === 'FORM_ANSWERS_INVALID'),
  ).toBe(true);
  expect(result.versions).toEqual([
    'FORM_VERSION_STALE',
    'FORM_VERSION_STALE',
    'accepted',
  ]);
  expect(result.alternate).toEqual(result.submission);
  expect(result.submission.markdown).not.toContain('untrusted notice');
  expect(result.submission.markdown).toContain(
    '````bash\necho ok\n```\n# still code\n````',
  );
  const tree = JSON.stringify(deriveMarkdownTree(result.submission.markdown));
  expect(tree).toContain('echo ok\\n```\\n# still code');
  expect(tree).not.toContain('signature');
});

it('rejects schema constraints, unknown attributes and ID collisions including generated IDs', () => {
  const base = decodeIssueFormYaml(completeIssueFormYaml) as {
    body: Record<string, unknown>[];
  };
  const mutate = (update: (copy: typeof base) => void) => {
    const copy = structuredClone(base);
    update(copy);
    expect(() => normalizeIssueFormDefinition(copy)).toThrow(IssueFormError);
  };
  mutate((v) => {
    v.body[1]!.id = 'field-1';
  });
  mutate((v) => {
    v.body[1]!.id = 'with spaces';
  });
  mutate((v) => {
    (v.body[1]!.validations as Record<string, unknown>).min_length = -1;
  });
  mutate((v) => {
    (v.body[1]!.validations as Record<string, unknown>).min_length = 1025;
  });
  mutate((v) => {
    (v.body[2]!.attributes as Record<string, unknown>).render = 'bash\n```';
  });
  mutate((v) => {
    (v.body[3]!.attributes as Record<string, unknown>).default = 2;
  });
  mutate((v) => {
    (v.body[3]!.attributes as Record<string, unknown>).options = [
      'Linux',
      'Linux',
    ];
  });
  mutate((v) => {
    (v.body[3]!.attributes as Record<string, unknown>).options = [
      'Linux',
      'None',
    ];
  });
  mutate((v) => {
    (v.body[3]!.attributes as Record<string, unknown>).multiple = 'false';
  });
  mutate((v) => {
    (v.body[5]!.attributes as Record<string, unknown>).options = [];
  });
  mutate((v) => {
    (v.body[6]!.validations as Record<string, unknown>).accept = 'image/*';
  });
  mutate((v) => {
    v.body[6]!.attributes = { label: 'Files', accept: '.png' };
  });
  mutate((v) => {
    v.body = Array.from({ length: 65 }, () => structuredClone(v.body[1]!));
  });
  mutate((v) => {
    v.body = [v.body[0]!];
  });
});

it('bounds JSON graphs, Unicode lengths and aggregate generated content', () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const getter = Object.defineProperty({}, 'name', {
    enumerable: true,
    get() {
      throw new Error('must not run');
    },
  });
  for (const input of [
    cycle,
    getter,
    {
      ...(decodeIssueFormYaml(completeIssueFormYaml) as object),
      body: Array(5),
    },
  ])
    expect(() => normalizeIssueFormDefinition(input)).toThrow(IssueFormError);
  const base = normalizeIssueFormDefinition(
    decodeIssueFormYaml(completeIssueFormYaml),
  );
  expect(() =>
    validateIssueFormAnswers(base, {
      ...validFormAnswers,
      version: '🐛'.repeat(1024),
    }),
  ).not.toThrow();
  const large = normalizeIssueFormDefinition({
    name: 'Large',
    description: 'Large form',
    body: Array.from({ length: 3 }, (_, index) => ({
      type: 'textarea',
      id: `q${index}`,
      attributes: { label: `Question ${index}` },
    })),
  });
  expect(() =>
    validateIssueFormAnswers(large, {
      q0: 'x'.repeat(16384),
      q1: 'x'.repeat(16384),
      q2: 'x'.repeat(16384),
    }),
  ).toThrow(IssueFormError);
  expect(() =>
    normalizeIssueFormDefinition({ ...base, schemaVersion: 2 }, 'canonical'),
  ).toThrow(IssueFormError);
});
