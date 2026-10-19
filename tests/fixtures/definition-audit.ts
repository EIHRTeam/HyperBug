import type {
  ContentDefinitionStore,
  SaveIssueForm,
  SaveIssueTemplate,
} from '@hyperbug/application';
import { auditEvent } from '../../packages/security/src/index.ts';
import type { RepositoryHarness } from './repository-contract.ts';

const actorId = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
async function event(
  harness: RepositoryHarness,
  input: SaveIssueForm | SaveIssueTemplate,
  action: 'form.saved' | 'template.saved',
) {
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Fixture manager', ?) ON CONFLICT (id) DO NOTHING",
    [actorId, input.now],
  );
  return auditEvent({
    id: crypto.randomUUID(),
    projectId: input.projectId,
    actorId,
    systemActor: null,
    action,
    targetId: input.id,
    result: 'success',
    requestId: crypto.randomUUID(),
    createdAt: input.now,
    metadata: {
      v: 1,
      version: (input.expectedRevision ?? 0) + 1,
      enabled: Number(input.enabled),
    },
  });
}
export async function saveAuditedForm(
  store: ContentDefinitionStore,
  harness: RepositoryHarness,
  input: SaveIssueForm,
) {
  return store.saveForm(input, await event(harness, input, 'form.saved'));
}
export async function saveAuditedTemplate(
  store: ContentDefinitionStore,
  harness: RepositoryHarness,
  input: SaveIssueTemplate,
) {
  return store.saveTemplate(
    input,
    await event(harness, input, 'template.saved'),
  );
}
