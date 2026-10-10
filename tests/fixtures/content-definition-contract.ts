import { expect, it } from 'vitest';
import {
  normalizeIssueFormDefinition,
  type ContentDefinitionStore,
} from '@hyperbug/application';
import { nearLimitIssueFormDefinition } from './content-storage-bound.ts';
import { nextId, type RepositoryHarness } from './repository-contract.ts';
const now = 1791000000000;
const formDefinition = (name = 'Report') =>
  normalizeIssueFormDefinition({
    name,
    description: 'Structured report',
    body: [
      {
        type: 'textarea',
        id: 'details',
        attributes: { label: 'Details' },
        validations: { required: true },
      },
    ],
  });
export function contentDefinitionContract(
  get: () => { harness: RepositoryHarness; store: ContentDefinitionStore },
  profile: 'd1' | 'postgres',
) {
  async function project() {
    const id = nextId();
    await get().harness.query(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, `definitions-${id}`, 'Definitions', now, now],
    );
    return id;
  }
  it('persists a near-limit canonical definition and rejects over-limit saves without a head', async () => {
    const { harness, store } = get();
    const projectId = await project();
    const id = nextId();
    const definition = normalizeIssueFormDefinition(
      nearLimitIssueFormDefinition(),
      'canonical',
    );
    await store.saveForm({
      id,
      projectId,
      expectedRevision: null,
      enabled: true,
      now,
      definition,
    });
    expect((await store.getForm(projectId, id))!.definition).toEqual(
      definition,
    );
    expect(
      (
        await harness.query(
          'SELECT length(CAST(definition AS TEXT)) AS length FROM issue_form_versions WHERE form_id = ?',
          [id],
        )
      )[0]!.length,
    ).toBe(
      profile === 'postgres' ? 65536 : [...JSON.stringify(definition)].length,
    );
    const rejected = nextId();
    await expect(
      store.saveForm({
        id: rejected,
        projectId,
        expectedRevision: null,
        enabled: true,
        now,
        definition: nearLimitIssueFormDefinition(1),
      }),
    ).rejects.toMatchObject({ code: 'FORM_DEFINITION_INVALID' });
    expect(
      await harness.query('SELECT id FROM issue_forms WHERE id = ?', [
        rejected,
      ]),
    ).toEqual([]);
  });
  it('versions project-owned forms/templates atomically, retains old content and hides disabled heads', async () => {
    const { harness, store } = get();
    const projectId = await project();
    const other = await project();
    const id = nextId();
    const first = await store.saveForm({
      id,
      projectId,
      expectedRevision: null,
      enabled: true,
      now,
      definition: formDefinition(),
    });
    expect(first).toMatchObject({
      id,
      projectId,
      revision: 1,
      version: 1,
      enabled: true,
    });
    const second = await store.saveForm({
      id,
      projectId,
      expectedRevision: 1,
      enabled: false,
      now: now + 1,
      definition: formDefinition('Edited'),
    });
    expect(second).toMatchObject({ revision: 2, version: 2, enabled: false });
    expect((await store.getForm(projectId, id, 1))!.definition).toEqual(
      first.definition,
    );
    expect(await store.getForm(other, id)).toBeNull();
    expect(await store.list('form', projectId, false)).toEqual([]);
    expect(await store.list('form', projectId, true)).toHaveLength(1);
    expect(
      JSON.stringify(await store.list('form', projectId, true)),
    ).not.toMatch(/definition|body/);
    await expect(
      store.saveTemplate({
        id: nextId(),
        projectId,
        expectedRevision: null,
        enabled: true,
        now,
        name: 'Edited',
        body: 'Conflict',
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_NAME_CONFLICT' });
    const templateId = nextId();
    const original = await store.saveTemplate({
      id: templateId,
      projectId,
      expectedRevision: null,
      enabled: true,
      now,
      name: 'Plain',
      body: '**canonical** <script>source</script>',
    });
    await store.saveTemplate({
      id: templateId,
      projectId,
      expectedRevision: 1,
      enabled: false,
      now: now + 2,
      name: 'Plain edited',
      body: 'Second body',
    });
    expect((await store.getTemplate(projectId, templateId, 1))!.body).toBe(
      original.body,
    );
    expect(await store.getTemplate(other, templateId)).toBeNull();
    expect(await store.list('template', projectId, false)).toEqual([]);
    await expect(
      harness.query(
        'UPDATE issue_template_versions SET body = ? WHERE template_id = ?',
        ['changed', templateId],
      ),
    ).rejects.toThrow('append-only');
    await expect(
      harness.query(
        'DELETE FROM issue_template_versions WHERE template_id = ?',
        [templateId],
      ),
    ).rejects.toThrow('append-only');
    if (profile === 'd1')
      await expect(
        harness.query(
          'INSERT OR REPLACE INTO issue_template_versions (project_id, template_id, version, name, body, enabled, created_at) VALUES (?, ?, 1, ?, ?, 1, ?)',
          [projectId, templateId, 'Replacement', 'overwrite', now],
        ),
      ).rejects.toThrow('append-only');
    await expect(
      harness.query(
        'UPDATE issue_form_versions SET definition = ? WHERE form_id = ?',
        ['{}', id],
      ),
    ).rejects.toThrow('append-only');
    expect(
      (
        await harness.query(
          'SELECT version FROM issue_form_versions WHERE form_id = ? ORDER BY version',
          [id],
        )
      ).map((v) => v.version),
    ).toEqual([1, 2]);
    expect(
      (
        await harness.query(
          'SELECT version FROM issue_template_versions WHERE template_id = ? ORDER BY version',
          [templateId],
        )
      ).map((v) => v.version),
    ).toEqual([1, 2]);
    await harness.query(
      "UPDATE projects SET status = 'archived' WHERE id = ?",
      [projectId],
    );
    await expect(
      store.saveForm({
        id,
        projectId,
        expectedRevision: 2,
        enabled: true,
        now,
        definition: formDefinition(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('allows one CAS winner and leaves no loser snapshot, including incomplete legacy heads', async () => {
    const { harness, store } = get();
    const projectId = await project();
    const id = nextId();
    await store.saveForm({
      id,
      projectId,
      expectedRevision: null,
      enabled: true,
      now,
      definition: formDefinition(),
    });
    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        store.saveForm({
          id,
          projectId,
          expectedRevision: 1,
          enabled: true,
          now: now + index,
          definition: formDefinition(`Winner ${index}`),
        }),
      ),
    );
    const successes = outcomes.filter((v) => v.status === 'fulfilled');
    expect(successes).toHaveLength(1);
    expect(
      outcomes
        .filter((v) => v.status === 'rejected')
        .every((v) => v.reason.code === 'REVISION_CONFLICT'),
    ).toBe(true);
    expect((await store.getForm(projectId, id))!.definition).toEqual(
      successes[0]!.value.definition,
    );
    expect(
      await harness.query(
        'SELECT version FROM issue_form_versions WHERE form_id = ? ORDER BY version',
        [id],
      ),
    ).toHaveLength(2);
    const legacy = nextId();
    await harness.query(
      "INSERT INTO issue_forms (id, project_id, name, revision) VALUES (?, ?, 'Incomplete legacy', 2)",
      [legacy, projectId],
    );
    await expect(
      store.saveForm({
        id: legacy,
        projectId,
        expectedRevision: 1,
        enabled: true,
        now,
        definition: formDefinition('Legacy loser'),
      }),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    expect(
      await harness.query(
        'SELECT version FROM issue_form_versions WHERE form_id = ?',
        [legacy],
      ),
    ).toEqual([]);
    expect(
      (
        await harness.query(
          'SELECT name, revision FROM issue_forms WHERE id = ?',
          [legacy],
        )
      )[0],
    ).toEqual({ name: 'Incomplete legacy', revision: 2 });
  });
  it('serializes cross-kind name/capacity claims and rejects project boundary mistakes', async () => {
    const { harness, store } = get();
    const projectId = await project();
    const shared = await Promise.allSettled([
      store.saveForm({
        id: nextId(),
        projectId,
        expectedRevision: null,
        enabled: true,
        now,
        definition: formDefinition('Same name'),
      }),
      store.saveTemplate({
        id: nextId(),
        projectId,
        expectedRevision: null,
        enabled: true,
        now,
        name: 'Same name',
        body: '',
      }),
    ]);
    expect(shared.filter((v) => v.status === 'fulfilled')).toHaveLength(1);
    expect(
      shared
        .filter((v) => v.status === 'rejected')
        .every((v) => v.reason.code === 'CONTENT_NAME_CONFLICT'),
    ).toBe(true);
    for (let index = 1; index < 63; index++)
      await harness.query(
        'INSERT INTO issue_templates (id, project_id, name, body) VALUES (?, ?, ?, ?)',
        [nextId(), projectId, `Legacy ${index}`, ''],
      );
    const race = await Promise.allSettled([
      store.saveForm({
        id: nextId(),
        projectId,
        expectedRevision: null,
        enabled: true,
        now,
        definition: formDefinition('Final form'),
      }),
      store.saveTemplate({
        id: nextId(),
        projectId,
        expectedRevision: null,
        enabled: true,
        now,
        name: 'Final template',
        body: '',
      }),
    ]);
    expect(race.filter((v) => v.status === 'fulfilled')).toHaveLength(1);
    expect(
      race
        .filter((v) => v.status === 'rejected')
        .every((v) => v.reason.code === 'CONTENT_CATALOG_LIMIT'),
    ).toBe(true);
    const count = await harness.query(
      'SELECT (SELECT COUNT(*) FROM issue_forms WHERE project_id = ?) + (SELECT COUNT(*) FROM issue_templates WHERE project_id = ?) AS count',
      [projectId, projectId],
    );
    expect(Number(count[0]!.count)).toBe(64);
    await expect(
      store.saveForm({
        id: nextId(),
        projectId: nextId(),
        expectedRevision: null,
        enabled: true,
        now,
        definition: formDefinition(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
}
