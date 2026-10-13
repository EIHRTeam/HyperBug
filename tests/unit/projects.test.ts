import { describe, expect, it } from 'vitest';
import {
  isValidProjectName,
  isValidProjectSlug,
  nameKeyOf,
  projectView,
  validateProjectRecord,
  isValidColor,
  isValidDueDate,
  isValidTaxonomyName,
  isValidTitle,
  validateLabelRecord,
  validateIssueTypeRecord,
  validateMilestoneRecord,
  type ProjectRecord,
  type MilestoneRecord,
} from '@hyperbug/application';

const now = Date.now();
const projectId = crypto.randomUUID();

/** Invalid enum values are exactly what these cases must reject at runtime. */
const asRecord = (value: unknown): ProjectRecord => value as ProjectRecord;
const asMilestone = (value: unknown): MilestoneRecord =>
  value as MilestoneRecord;

describe('project validation', () => {
  it('accepts DNS-safe lowercase slugs only', () => {
    expect(isValidProjectSlug('abc')).toBe(true);
    expect(isValidProjectSlug('a-b-c')).toBe(true);
    expect(isValidProjectSlug('a')).toBe(true);
    expect(isValidProjectSlug('A')).toBe(false);
    expect(isValidProjectSlug('-abc')).toBe(false);
    expect(isValidProjectSlug('abc-')).toBe(false);
    expect(isValidProjectSlug('a_b')).toBe(false);
    expect(isValidProjectSlug('a'.repeat(64))).toBe(false);
    expect(isValidProjectSlug('')).toBe(false);
  });

  it('bounds project names by code points', () => {
    expect(isValidProjectName('Rocket 🚀 tracker')).toBe(true);
    expect(isValidProjectName('x'.repeat(101))).toBe(false);
    expect(isValidProjectName('')).toBe(false);
    expect(isValidProjectName('a\0b')).toBe(false);
  });

  it('validates the full record including timestamp order', () => {
    expect(() =>
      validateProjectRecord({
        id: projectId,
        slug: 'rocket',
        name: 'Rocket',
        visibility: 'public',
        status: 'active',
        nextIssueNumber: 1,
        revision: 1,
        createdAtMs: now,
        updatedAtMs: now,
      }),
    ).not.toThrow();
    expect(() =>
      validateProjectRecord(
        asRecord({
          id: projectId,
          slug: 'rocket',
          name: 'Rocket',
          visibility: 'internal',
          status: 'active',
          nextIssueNumber: 1,
          revision: 1,
          createdAtMs: now,
          updatedAtMs: now,
        }),
      ),
    ).toThrow();
    expect(() =>
      validateProjectRecord({
        id: 'not-a-uuid',
        slug: 'rocket',
        name: 'Rocket',
        visibility: 'public',
        status: 'active',
        nextIssueNumber: 1,
        revision: 1,
        createdAtMs: now,
        updatedAtMs: now,
      }),
    ).toThrow();
    expect(() =>
      validateProjectRecord({
        id: projectId,
        slug: 'rocket',
        name: 'Rocket',
        visibility: 'public',
        status: 'active',
        nextIssueNumber: 1,
        revision: 1,
        createdAtMs: now,
        updatedAtMs: now - 1,
      }),
    ).toThrow();
  });

  it('projects a public view without the number counter', () => {
    const view = projectView({
      id: projectId,
      slug: 'rocket',
      name: 'Rocket',
      visibility: 'private',
      status: 'archived',
      nextIssueNumber: 42,
      revision: 3,
      createdAtMs: now,
      updatedAtMs: now,
    });
    expect(view).not.toHaveProperty('nextIssueNumber');
    expect(view.revision).toBe(3);
    expect(view.createdAt).toBe(new Date(now).toISOString());
  });
});

describe('taxonomy validation', () => {
  it('normalizes names into conflict-domain keys', () => {
    expect(nameKeyOf('Bug')).toBe('bug');
    expect(nameKeyOf('  Help    Wanted  ')).toBe('help-wanted');
    expect(nameKeyOf('Émoji 🚀')).toBe('émoji-🚀');
  });

  it('accepts six-hex colors and rejects others', () => {
    expect(isValidColor('#a1b2c3')).toBe(true);
    expect(isValidColor('')).toBe(true);
    expect(isValidColor('#A1B2C3')).toBe(false);
    expect(isValidColor('red')).toBe(false);
    expect(isValidColor('#a1b2')).toBe(false);
  });

  it('accepts real calendar dates only', () => {
    expect(isValidDueDate('2026-02-28')).toBe(true);
    expect(isValidDueDate(null)).toBe(true);
    expect(isValidDueDate('2026-02-30')).toBe(false);
    expect(isValidDueDate('2026-13-01')).toBe(false);
    expect(isValidDueDate('20260228')).toBe(false);
    expect(isValidDueDate('2026-2-8')).toBe(false);
  });

  it('validates taxonomy names and titles', () => {
    expect(isValidTaxonomyName('Bug')).toBe(true);
    expect(isValidTaxonomyName('   ')).toBe(false);
    expect(isValidTaxonomyName('x'.repeat(101))).toBe(false);
    expect(isValidTitle('v1.0 Launch')).toBe(true);
    expect(isValidTitle('')).toBe(false);
    expect(isValidTitle(' '.repeat(201))).toBe(false);
  });

  it('validates label, issue-type and milestone records', () => {
    expect(() =>
      validateLabelRecord({
        id: crypto.randomUUID(),
        projectId,
        name: 'Bug',
        nameKey: 'bug',
        description: '',
        color: '#ff0000',
        revision: 1,
      }),
    ).not.toThrow();
    expect(() =>
      validateLabelRecord({
        id: crypto.randomUUID(),
        projectId,
        name: 'Bug',
        nameKey: 'wrong-key',
        description: '',
        color: '',
        revision: 1,
      }),
    ).toThrow();
    expect(() =>
      validateIssueTypeRecord({
        id: crypto.randomUUID(),
        projectId,
        name: 'Bug',
        nameKey: 'bug',
        description: '',
        icon: '🐛',
        color: '',
        position: 0,
        enabled: true,
        revision: 1,
      }),
    ).not.toThrow();
    expect(() =>
      validateMilestoneRecord({
        id: crypto.randomUUID(),
        projectId,
        title: 'v1.0',
        description: '',
        state: 'open',
        dueDate: '2026-12-31',
        revision: 1,
        createdAtMs: now,
        updatedAtMs: now,
      }),
    ).not.toThrow();
    expect(() =>
      validateMilestoneRecord(
        asMilestone({
          id: crypto.randomUUID(),
          projectId,
          title: 'v1.0',
          description: '',
          state: 'later',
          dueDate: null,
          revision: 1,
          createdAtMs: now,
          updatedAtMs: now,
        }),
      ),
    ).toThrow();
  });
});
