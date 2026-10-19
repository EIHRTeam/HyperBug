import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { OperationTypes } from '@hyperbug/api-client';
import { useProductApi, useProductQuery } from '../product-api.ts';
import { productError } from '../product-state.ts';
import { CommandForm } from './command-form.tsx';
import { QueryStatus } from './product.tsx';
type IssueDocument =
  OperationTypes['GET /api/v1/projects/{projectId}/issues/{issueId}']['response'];

export function IssueTriage({ issue }: { issue: IssueDocument }) {
  const { projectId, id: issueId } = issue;
  const [snapshot, setSnapshot] = useState(issue);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState('');
  const api = useProductApi();
  const cache = useQueryClient();
  const [generation, setGeneration] = useState(0);
  const receipts = useRef(new Map<string, string>());
  const labels = useProductQuery('GET /api/v1/projects/{projectId}/labels', {
    params: { projectId },
  });
  const types = useProductQuery(
    'GET /api/v1/projects/{projectId}/issue-types',
    { params: { projectId } },
  );
  const milestones = useProductQuery(
    'GET /api/v1/projects/{projectId}/milestones',
    { params: { projectId } },
  );
  function key(operation: string, body: unknown) {
    const fingerprint = JSON.stringify([operation, body]);
    let value = receipts.current.get(fingerprint);
    if (!value) {
      value = crypto.randomUUID();
      receipts.current.set(fingerprint, value);
    }
    return value;
  }
  async function changed(work: Promise<unknown>) {
    await work;
    const latest = await api.request(
      'GET /api/v1/projects/{projectId}/issues/{issueId}',
      { params: { projectId, issueId } },
    );
    setSnapshot(latest);
    await cache.invalidateQueries({
      queryKey: ['product', api.origin, api.state.epoch],
    });
  }
  const reason = [
    'completed',
    'not_planned',
    'duplicate',
    'invalid',
    'cannot_reproduce',
  ] as const;
  return (
    <details>
      <summary>Triage issue</summary>
      <p>
        Triage or higher permission is required. Conflicts preserve your edits;
        reload current values before retrying a changed revision.
      </p>
      <button
        type="button"
        disabled={reloading}
        onClick={async () => {
          setReloading(true);
          setReloadError('');
          try {
            const latest = await api.request(
              'GET /api/v1/projects/{projectId}/issues/{issueId}',
              { params: { projectId, issueId } },
            );
            setSnapshot(latest);
            setGeneration((value) => value + 1);
            receipts.current.clear();
          } catch (error) {
            setReloadError(productError(error));
          } finally {
            setReloading(false);
          }
        }}
      >
        Discard triage edits and reload latest values
      </button>
      <output>{reloadError}</output>
      <fieldset key={generation} disabled={reloading}>
        <legend>Issue triage changes</legend>
        {snapshot.state === 'open' ? (
          <CommandForm
            key="close"
            label="Close issue"
            confirm
            fields={[
              {
                name: 'reason',
                label: 'Close reason',
                value: 'completed',
                options: reason,
              },
            ]}
            onSave={(value) => {
              const body = {
                expectedRevision: snapshot.revision,
                reason: value.reason as (typeof reason)[number],
              };
              return changed(
                api.request(
                  'POST /api/v1/projects/{projectId}/issues/{issueId}/close',
                  {
                    params: { projectId, issueId },
                    body,
                    idempotencyKey: key('close', body),
                  },
                ),
              );
            }}
          />
        ) : (
          <CommandForm
            key="reopen"
            label="Reopen issue"
            confirm
            fields={[]}
            onSave={() => {
              const body = { expectedRevision: snapshot.revision };
              return changed(
                api.request(
                  'POST /api/v1/projects/{projectId}/issues/{issueId}/reopen',
                  {
                    params: { projectId, issueId },
                    body,
                    idempotencyKey: key('reopen', body),
                  },
                ),
              );
            }}
          />
        )}
        <QueryStatus query={labels} />
        <p>
          Available labels:{' '}
          {labels.data?.labels
            .map((entry) => `${entry.name} (${entry.id})`)
            .join(', ') || 'None'}
          .
        </p>
        <CommandForm
          label="Set issue labels"
          fields={[
            {
              name: 'ids',
              label: 'Label IDs, separated by commas; empty clears labels',
              value: snapshot.labelIds.join(', '),
            },
          ]}
          onSave={(value) => {
            const body = {
              expectedRevision: snapshot.revision,
              labelIds: value
                .ids!.split(',')
                .map((id) => id.trim())
                .filter(Boolean),
            };
            return changed(
              api.request(
                'PUT /api/v1/projects/{projectId}/issues/{issueId}/labels',
                {
                  params: { projectId, issueId },
                  body,
                  idempotencyKey: key('labels', body),
                },
              ),
            );
          }}
        />
        <CommandForm
          label="Set issue assignees"
          fields={[
            {
              name: 'ids',
              label:
                'Staff principal IDs, separated by commas; empty clears assignees',
              value: snapshot.assigneeIds.join(', '),
            },
          ]}
          onSave={(value) => {
            const body = {
              expectedRevision: snapshot.revision,
              assigneeIds: value
                .ids!.split(',')
                .map((id) => id.trim())
                .filter(Boolean),
            };
            return changed(
              api.request(
                'PUT /api/v1/projects/{projectId}/issues/{issueId}/assignees',
                {
                  params: { projectId, issueId },
                  body,
                  idempotencyKey: key('assignees', body),
                },
              ),
            );
          }}
        />
        <QueryStatus query={types} />
        <p>
          Available types:{' '}
          {types.data?.types
            .filter((type) => type.enabled)
            .map((type) => `${type.name} (${type.id})`)
            .join(', ') || 'None'}
          .
        </p>
        <CommandForm
          label="Set issue type"
          fields={[
            {
              name: 'id',
              label: 'Issue type ID; empty clears type',
              value: snapshot.typeId ?? '',
            },
          ]}
          onSave={(value) => {
            const body = {
              expectedRevision: snapshot.revision,
              typeId: value.id || null,
            };
            return changed(
              api.request(
                'PUT /api/v1/projects/{projectId}/issues/{issueId}/type',
                {
                  params: { projectId, issueId },
                  body,
                  idempotencyKey: key('type', body),
                },
              ),
            );
          }}
        />
        <QueryStatus query={milestones} />
        <p>
          Available milestones:{' '}
          {milestones.data?.milestones
            .map((entry) => `${entry.title} (${entry.id})`)
            .join(', ') || 'None'}
          .
        </p>
        <CommandForm
          label="Set issue milestone"
          fields={[
            {
              name: 'id',
              label: 'Milestone ID; empty clears milestone',
              value: snapshot.milestoneId ?? '',
            },
          ]}
          onSave={(value) => {
            const body = {
              expectedRevision: snapshot.revision,
              milestoneId: value.id || null,
            };
            return changed(
              api.request(
                'PUT /api/v1/projects/{projectId}/issues/{issueId}/milestone',
                {
                  params: { projectId, issueId },
                  body,
                  idempotencyKey: key('milestone', body),
                },
              ),
            );
          }}
        />
      </fieldset>
    </details>
  );
}
