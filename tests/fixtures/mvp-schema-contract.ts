import { beforeEach, describe, expect, it } from 'vitest';
import { nextId, type RepositoryHarness } from './repository-contract.ts';

export function mvpSchemaContract(get: () => RepositoryHarness) {
  describe('MVP physical invariants', () => {
    let project: string;
    let other: string;
    let user: string;
    let staff: string;
    let issue: string;
    let otherIssue: string;
    const now = 1789689600000;
    const query = (sql: string, values: (string | number)[] = []) =>
      get().query(sql, values);
    beforeEach(async () => {
      project = nextId();
      other = nextId();
      user = nextId();
      staff = nextId();
      issue = nextId();
      otherIssue = nextId();
      for (const id of [project, other])
        await query(
          'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [id, `mvp-${id}`, 'MVP fixture', now, now],
        );
      for (const [id, kind] of [
        [user, 'user'],
        [staff, 'staff'],
      ])
        await query(
          'INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, ?, ?, ?)',
          [String(id), String(kind), 'Fixture', now],
        );
      for (const [id, projectId] of [
        [issue, project],
        [otherIssue, other],
      ])
        await query(
          "INSERT INTO issues (id, project_id, number, title, body, author_id, created_at, updated_at, last_mutation_id) VALUES (?, ?, 1, 'MVP issue', '', ?, ?, ?, ?)",
          [String(id), String(projectId), user, now, now, nextId()],
        );
    });

    it('requires Staff membership for grants and assignments; external subject linkage is unique', async () => {
      await expect(
        query(
          "INSERT INTO project_roles (project_id, principal_id, role, granted_at) VALUES (?, ?, 'triage', ?)",
          [project, user, now],
        ),
      ).rejects.toThrow();
      await query(
        "INSERT INTO project_roles (project_id, principal_id, role, granted_at) VALUES (?, ?, 'triage', ?)",
        [project, staff, now],
      );
      await query(
        'INSERT INTO issue_assignees (project_id, issue_id, principal_id) VALUES (?, ?, ?)',
        [project, issue, staff],
      );
      await expect(
        query(
          'INSERT INTO issue_assignees (project_id, issue_id, principal_id) VALUES (?, ?, ?)',
          [other, otherIssue, staff],
        ),
      ).rejects.toThrow();
      await expect(
        query("UPDATE principals SET kind = 'user' WHERE id = ?", [staff]),
      ).rejects.toThrow();
      await expect(
        query(
          'DELETE FROM project_roles WHERE project_id = ? AND principal_id = ?',
          [project, staff],
        ),
      ).rejects.toThrow();
      await query(
        "INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES (?, ?, 'oidc', 'https://issuer.example', ?, ?)",
        [nextId(), staff, staff, now],
      );
      await expect(
        query(
          "INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES (?, ?, 'oidc', 'https://issuer.example', ?, ?)",
          [nextId(), user, staff, now],
        ),
      ).rejects.toThrow();
    });

    it('keeps labels, issue types and milestones within their owning project', async () => {
      const label = nextId();
      const type = nextId();
      const milestone = nextId();
      await query(
        "INSERT INTO labels (id, project_id, name, name_key) VALUES (?, ?, 'Bug', 'bug')",
        [label, project],
      );
      await query(
        "INSERT INTO issue_types (id, project_id, name, name_key) VALUES (?, ?, 'Bug', 'bug')",
        [type, project],
      );
      await query(
        "INSERT INTO milestones (id, project_id, title, created_at, updated_at) VALUES (?, ?, 'Release', ?, ?)",
        [milestone, project, now, now],
      );
      await query(
        'INSERT INTO issue_labels (project_id, issue_id, label_id) VALUES (?, ?, ?)',
        [project, issue, label],
      );
      await expect(
        query(
          'INSERT INTO issue_labels (project_id, issue_id, label_id) VALUES (?, ?, ?)',
          [project, issue, label],
        ),
      ).rejects.toThrow();
      await expect(
        query(
          'INSERT INTO issue_labels (project_id, issue_id, label_id) VALUES (?, ?, ?)',
          [other, otherIssue, label],
        ),
      ).rejects.toThrow();
      await query(
        'UPDATE issues SET type_id = ?, milestone_id = ? WHERE id = ?',
        [type, milestone, issue],
      );
      await expect(
        query('UPDATE issues SET type_id = ? WHERE id = ?', [type, otherIssue]),
      ).rejects.toThrow();
      await expect(
        query('UPDATE issues SET milestone_id = ? WHERE id = ?', [
          milestone,
          otherIssue,
        ]),
      ).rejects.toThrow();
      await expect(
        query(
          "INSERT INTO labels (id, project_id, name, name_key) VALUES (?, ?, 'BUG', 'bug')",
          [nextId(), project],
        ),
      ).rejects.toThrow();
    });

    it('retains immutable comment history and prevents cross-project comment/reaction links', async () => {
      const comment = nextId();
      const insertComment = (projectId: string) =>
        query(
          "INSERT INTO comments (id, project_id, issue_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, 'Comment', ?, ?)",
          [comment, projectId, issue, user, now, now],
        );
      await expect(insertComment(other)).rejects.toThrow();
      await insertComment(project);
      await query(
        "INSERT INTO comment_history (id, project_id, comment_id, revision, editor_id, body, changed_at) VALUES (?, ?, ?, 1, ?, 'Prior text', ?)",
        [nextId(), project, comment, user, now],
      );
      await expect(
        query(
          "UPDATE comment_history SET body = 'rewrite' WHERE comment_id = ?",
          [comment],
        ),
      ).rejects.toThrow('append-only');
      await expect(
        query('DELETE FROM comment_history WHERE comment_id = ?', [comment]),
      ).rejects.toThrow('append-only');
      await query(
        "INSERT INTO reactions (id, project_id, comment_id, principal_id, reaction, created_at) VALUES (?, ?, ?, ?, 'heart', ?)",
        [nextId(), project, comment, user, now],
      );
      await expect(
        query(
          "INSERT INTO reactions (id, project_id, comment_id, principal_id, reaction, created_at) VALUES (?, ?, ?, ?, 'heart', ?)",
          [nextId(), project, comment, user, now],
        ),
      ).rejects.toThrow();
      await expect(
        query(
          "INSERT INTO reactions (id, project_id, comment_id, principal_id, reaction, created_at) VALUES (?, ?, ?, ?, 'eyes', ?)",
          [nextId(), other, comment, user, now],
        ),
      ).rejects.toThrow();
      await expect(
        query(
          "INSERT INTO reactions (id, project_id, issue_id, comment_id, principal_id, reaction, created_at) VALUES (?, ?, ?, ?, ?, 'eyes', ?)",
          [nextId(), project, issue, comment, user, now],
        ),
      ).rejects.toThrow();
      await expect(
        query(
          "INSERT INTO reactions (id, project_id, principal_id, reaction, created_at) VALUES (?, ?, ?, 'eyes', ?)",
          [nextId(), project, user, now],
        ),
      ).rejects.toThrow();
    });

    it('pins form submissions to immutable project-local versions', async () => {
      const form = nextId();
      await query(
        "INSERT INTO issue_forms (id, project_id, name) VALUES (?, ?, 'Bug report')",
        [form, project],
      );
      await query(
        "INSERT INTO issue_form_versions (project_id, form_id, version, schema_version, definition, created_at) VALUES (?, ?, 1, 1, '{}', ?)",
        [project, form, now],
      );
      await query(
        'INSERT INTO form_submissions (project_id, issue_id, form_id, form_version, "values", created_at) VALUES (?, ?, ?, 1, \'{}\', ?)',
        [project, issue, form, now],
      );
      await expect(
        query(
          'INSERT INTO form_submissions (project_id, issue_id, form_id, form_version, "values", created_at) VALUES (?, ?, ?, 1, \'{}\', ?)',
          [other, otherIssue, form, now],
        ),
      ).rejects.toThrow();
      await expect(
        query(
          'UPDATE issue_form_versions SET schema_version = 2 WHERE form_id = ?',
          [form],
        ),
      ).rejects.toThrow('append-only');
      await expect(
        query('DELETE FROM issue_form_versions WHERE form_id = ?', [form]),
      ).rejects.toThrow('append-only');
      await query(
        "INSERT INTO issue_templates (id, project_id, name, body) VALUES (?, ?, 'Blank', '')",
        [nextId(), project],
      );
    });

    it('binds upload and attachment metadata to one project and one target', async () => {
      const upload = nextId();
      await query(
        "INSERT INTO upload_intents (id, project_id, principal_id, object_key, media_type, max_bytes, created_at, expires_at) VALUES (?, ?, ?, ?, 'text/plain', 1024, ?, ?)",
        [upload, project, user, upload, now, now + 1000],
      );
      await expect(
        query("UPDATE upload_intents SET state = 'finalized' WHERE id = ?", [
          upload,
        ]),
      ).rejects.toThrow();
      await expect(
        query('UPDATE upload_intents SET actual_bytes = 1025 WHERE id = ?', [
          upload,
        ]),
      ).rejects.toThrow();
      await expect(
        query('UPDATE upload_intents SET max_bytes = ? WHERE id = ?', [
          1.5,
          upload,
        ]),
      ).rejects.toThrow();
      await query(
        "UPDATE upload_intents SET state = 'finalized', verified_object_version = 'v1', verified_checksum = 'checksum', actual_bytes = 10 WHERE id = ?",
        [upload],
      );
      const insert = (projectId: string, issueId: string) =>
        query(
          "INSERT INTO attachments (id, project_id, upload_intent_id, issue_id, object_key, object_version, checksum, media_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, 'v1', 'checksum', 'text/plain', 10, ?)",
          [nextId(), projectId, upload, issueId, upload, now],
        );
      await expect(insert(other, otherIssue)).rejects.toThrow();
      await insert(project, issue);
      await expect(insert(project, issue)).rejects.toThrow();
    });

    it('keeps plugin metadata within its installation scope with bounded versioned JSON', async () => {
      const installation = nextId();
      await query(
        "INSERT INTO plugin_installations (id, project_id, scope_key, plugin_id, plugin_version, manifest_version, created_at) VALUES (?, ?, ?, 'example', '1.0.0', 1, ?)",
        [installation, project, project, now],
      );
      const insert = (scope: string, value: string) =>
        query(
          "INSERT INTO plugin_metadata (installation_id, scope_key, namespace, owner_type, owner_id, key, value, schema_version) VALUES (?, ?, 'example', 'issue', ?, 'data', ?, 1)",
          [installation, scope, issue, value],
        );
      await expect(insert(other, '{}')).rejects.toThrow();
      await expect(
        insert(project, JSON.stringify({ oversized: 'a'.repeat(65536) })),
      ).rejects.toThrow();
      await insert(project, '{}');
      await expect(
        query(
          "INSERT INTO plugin_installations (id, scope_key, plugin_id, plugin_version, manifest_version, created_at) VALUES (?, 'deployment', 'example', '1.0.0', 1, ?)",
          [nextId(), now],
        ),
      ).resolves.toBeDefined();
      await expect(
        query(
          "INSERT INTO plugin_installations (id, scope_key, plugin_id, plugin_version, manifest_version, created_at) VALUES (?, 'deployment', 'example', '1.0.0', 1, ?)",
          [nextId(), now],
        ),
      ).rejects.toThrow();
    });

    it('requires exactly one principal or system actor for timeline events', async () => {
      const insert = (actor: boolean) =>
        query(
          `INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, actor_id, system_actor, action, created_at, metadata) VALUES (?, ?, ?, 2, ${actor ? '?' : 'NULL'}, 'fixture.service', 'fixture', ?, '{}')`,
          [nextId(), project, issue, ...(actor ? [staff] : []), now],
        );
      await expect(insert(true)).rejects.toThrow();
      await insert(false);
      await expect(
        query('UPDATE projects SET next_issue_number = ? WHERE id = ?', [
          1.5,
          project,
        ]),
      ).rejects.toThrow();
    });
  });
}
