import { lazy, Suspense, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { manageRoute, useAuth } from '../app.tsx';
import { ProjectNav, QueryStatus } from '../components/product.tsx';
import { useProductApi, useProductQuery } from '../product-api.ts';
import { CommandForm, type CommandField } from '../components/command-form.tsx';
import { productError, projectIdPattern } from '../product-state.ts';

const colorField = (value = ''): CommandField => ({
  name: 'color',
  label: 'Color (#rrggbb or empty)',
  value,
  maxLength: 7,
  validate: (answer) =>
    /^(#[0-9a-f]{6})?$/.test(answer)
      ? undefined
      : 'Use a lower-case hexadecimal color such as #24683b, or leave empty.',
});
const typeFields = (value?: {
  description: string;
  icon: string;
  color: string;
  position: number;
}): CommandField[] => [
  {
    name: 'description',
    label: 'Description',
    value: value?.description ?? '',
    multiline: true,
    maxLength: 4096,
  },
  {
    name: 'icon',
    label: 'Icon text',
    value: value?.icon ?? '',
    maxLength: 100,
  },
  colorField(value?.color),
  {
    name: 'position',
    label: 'Sort position',
    value: String(value?.position ?? 0),
    inputType: 'number',
    required: true,
    validate: (answer) =>
      /^\d+$/.test(answer) && Number.isSafeInteger(Number(answer))
        ? undefined
        : 'Enter a non-negative whole sort position.',
  },
];
const dueDateField = (value = ''): CommandField => ({
  name: 'dueDate',
  label: 'Due date (optional)',
  value,
  inputType: 'date',
  maxLength: 10,
});

const Audit = lazy(() =>
  import('../components/audit-browser.tsx').then((module) => ({
    default: module.AuditBrowser,
  })),
);
export function Manage() {
  const { projectId } = manageRoute.useParams();
  const [showAudit, setShowAudit] = useState(false);
  const [draftGeneration, setDraftGeneration] = useState(0);
  const { state } = useAuth();
  const api = useProductApi();
  const cache = useQueryClient();
  const valid = projectIdPattern.test(projectId);
  const project = useProductQuery(
    'GET /api/v1/projects/{projectId}',
    { params: { projectId } },
    valid,
  );
  const labels = useProductQuery(
    'GET /api/v1/projects/{projectId}/labels',
    { params: { projectId } },
    valid,
  );
  const types = useProductQuery(
    'GET /api/v1/projects/{projectId}/issue-types',
    { params: { projectId } },
    valid,
  );
  const milestones = useProductQuery(
    'GET /api/v1/projects/{projectId}/milestones',
    { params: { projectId } },
    valid,
  );
  const forms = useProductQuery(
    'GET /api/v1/projects/{projectId}/forms',
    { params: { projectId } },
    valid,
  );
  const templates = useProductQuery(
    'GET /api/v1/projects/{projectId}/templates',
    { params: { projectId } },
    valid,
  );
  const [reloadSnapshot, setReloadSnapshot] = useState<{
    project: typeof project.data;
    labels: typeof labels.data;
    types: typeof types.data;
    milestones: typeof milestones.data;
    forms: typeof forms.data;
    templates: typeof templates.data;
  }>();
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState('');
  const projectData = reloadSnapshot?.project ?? project.data;
  const labelsData = reloadSnapshot?.labels ?? labels.data;
  const typesData = reloadSnapshot?.types ?? types.data;
  const milestonesData = reloadSnapshot?.milestones ?? milestones.data;
  const formsData = reloadSnapshot?.forms ?? forms.data;
  const templatesData = reloadSnapshot?.templates ?? templates.data;
  async function changed(work: Promise<unknown>) {
    await work;
    await cache.invalidateQueries({
      queryKey: ['product', api.origin, state.epoch],
    });
  }
  if (!valid) return <h1>Invalid project address</h1>;
  return (
    <>
      <h1>Manage project</h1>
      <ProjectNav projectId={projectId} />
      <QueryStatus query={project} />
      {state.account?.kind !== 'staff' ? (
        <p>
          Sign in with your Staff identity to manage this project. The instance
          checks the permission required for each action.
        </p>
      ) : (
        <>
          <p>
            {projectData?.name}. Settings and membership require Administrator;
            taxonomy and forms require Maintainer. Reload current values after a
            conflict before resubmitting.
          </p>
          <button
            type="button"
            disabled={reloading}
            onClick={async () => {
              setReloading(true);
              setReloadError('');
              try {
                const [p, l, t, m, f, templatesResult] = await Promise.all([
                  project.refetch({ throwOnError: true }),
                  labels.refetch({ throwOnError: true }),
                  types.refetch({ throwOnError: true }),
                  milestones.refetch({ throwOnError: true }),
                  forms.refetch({ throwOnError: true }),
                  templates.refetch({ throwOnError: true }),
                ]);
                setReloadSnapshot({
                  project: p.data,
                  labels: l.data,
                  types: t.data,
                  milestones: m.data,
                  forms: f.data,
                  templates: templatesResult.data,
                });
                setDraftGeneration((value) => value + 1);
              } catch (error) {
                setReloadError(productError(error));
              } finally {
                setReloading(false);
              }
            }}
          >
            Discard draft settings and reload latest values
          </button>
          <output>{reloadError}</output>
          <fieldset key={draftGeneration} disabled={reloading}>
            <legend>Project changes</legend>
            <details>
              <summary>Project settings</summary>
              {projectData ? (
                <>
                  <CommandForm
                    label="Save project settings"
                    confirm
                    fields={[
                      {
                        name: 'name',
                        label: 'Project name',
                        value: projectData.name,
                        required: true,
                        maxLength: 100,
                      },
                      {
                        name: 'visibility',
                        label: 'Visibility',
                        value: projectData.visibility,
                        options: ['public', 'private'],
                      },
                    ]}
                    onSave={(value) =>
                      changed(
                        api.request('PATCH /api/v1/projects/{projectId}', {
                          params: { projectId },
                          body: {
                            expectedRevision: projectData.revision,
                            name: value.name!,
                            visibility: value.visibility as
                              | 'public'
                              | 'private',
                          },
                        }),
                      )
                    }
                  />
                  <CommandForm
                    label="Archive project"
                    confirm
                    fields={[]}
                    onSave={() =>
                      changed(
                        api.request(
                          'POST /api/v1/projects/{projectId}/archive',
                          {
                            params: { projectId },
                            body: { expectedRevision: projectData.revision },
                          },
                        ),
                      )
                    }
                  />
                </>
              ) : null}
            </details>
            <details>
              <summary>Labels</summary>
              <QueryStatus query={labels} />
              <CommandForm
                label="Create label"
                fields={[
                  {
                    name: 'name',
                    label: 'Label name',
                    required: true,
                    maxLength: 100,
                  },
                  {
                    name: 'description',
                    label: 'Description',
                    maxLength: 4096,
                  },
                  colorField(),
                ]}
                onSave={(value) =>
                  changed(
                    api.request('POST /api/v1/projects/{projectId}/labels', {
                      params: { projectId },
                      body: {
                        name: value.name!,
                        description: value.description!,
                        color: value.color!,
                      },
                    }),
                  )
                }
              />
              {labelsData?.labels.map((label) => (
                <section key={label.id}>
                  <h2>{label.name}</h2>
                  <CommandForm
                    label={`Save label ${label.name}`}
                    fields={[
                      {
                        name: 'name',
                        label: 'Name',
                        value: label.name,
                        required: true,
                      },
                      {
                        name: 'description',
                        label: 'Description',
                        value: label.description,
                        maxLength: 4096,
                      },
                      colorField(label.color),
                    ]}
                    onSave={(value) =>
                      changed(
                        api.request(
                          'PATCH /api/v1/projects/{projectId}/labels/{labelId}',
                          {
                            params: { projectId, labelId: label.id },
                            body: {
                              expectedRevision: label.revision,
                              name: value.name!,
                              description: value.description!,
                              color: value.color!,
                            },
                          },
                        ),
                      )
                    }
                  />
                  <CommandForm
                    label={`Delete label ${label.name}`}
                    confirm
                    fields={[]}
                    onSave={() =>
                      changed(
                        api.request(
                          'DELETE /api/v1/projects/{projectId}/labels/{labelId}',
                          {
                            params: { projectId, labelId: label.id },
                            body: {},
                          },
                        ),
                      )
                    }
                  />
                </section>
              ))}
            </details>
            <details>
              <summary>Issue types</summary>
              <QueryStatus query={types} />
              <CommandForm
                label="Create issue type"
                fields={[
                  {
                    name: 'name',
                    label: 'Type name',
                    required: true,
                    maxLength: 100,
                  },
                  ...typeFields(),
                ]}
                onSave={(value) =>
                  changed(
                    api.request(
                      'POST /api/v1/projects/{projectId}/issue-types',
                      {
                        params: { projectId },
                        body: {
                          name: value.name!,
                          description: value.description!,
                          icon: value.icon!,
                          color: value.color!,
                          position: Number(value.position),
                        },
                      },
                    ),
                  )
                }
              />
              {typesData?.types.map((type) => (
                <section key={type.id}>
                  <h2>{type.name}</h2>
                  <CommandForm
                    label={`Save type ${type.name}`}
                    fields={[
                      {
                        name: 'name',
                        label: 'Name',
                        value: type.name,
                        required: true,
                      },
                      ...typeFields(type),
                      {
                        name: 'enabled',
                        label: 'Enabled',
                        value: String(type.enabled),
                        options: ['true', 'false'],
                      },
                    ]}
                    onSave={(value) =>
                      changed(
                        api.request(
                          'PATCH /api/v1/projects/{projectId}/issue-types/{typeId}',
                          {
                            params: { projectId, typeId: type.id },
                            body: {
                              expectedRevision: type.revision,
                              name: value.name!,
                              description: value.description!,
                              icon: value.icon!,
                              color: value.color!,
                              position: Number(value.position),
                              enabled: value.enabled === 'true',
                            },
                          },
                        ),
                      )
                    }
                  />
                  <CommandForm
                    label={`Delete type ${type.name}`}
                    confirm
                    fields={[]}
                    onSave={() =>
                      changed(
                        api.request(
                          'DELETE /api/v1/projects/{projectId}/issue-types/{typeId}',
                          { params: { projectId, typeId: type.id }, body: {} },
                        ),
                      )
                    }
                  />
                </section>
              ))}
            </details>
            <details>
              <summary>Milestones</summary>
              <QueryStatus query={milestones} />
              <CommandForm
                label="Create milestone"
                fields={[
                  {
                    name: 'title',
                    label: 'Milestone title',
                    required: true,
                    maxLength: 200,
                  },
                  {
                    name: 'description',
                    label: 'Description',
                    multiline: true,
                    maxLength: 32768,
                  },
                  dueDateField(),
                ]}
                onSave={(value) =>
                  changed(
                    api.request(
                      'POST /api/v1/projects/{projectId}/milestones',
                      {
                        params: { projectId },
                        body: {
                          title: value.title!,
                          description: value.description!,
                          dueDate: value.dueDate || null,
                        },
                      },
                    ),
                  )
                }
              />
              {milestonesData?.milestones.map((milestone) => (
                <section key={milestone.id}>
                  <h2>{milestone.title}</h2>
                  <p>
                    {milestone.progress.open} open / {milestone.progress.closed}{' '}
                    closed
                  </p>
                  <CommandForm
                    label={`Save milestone ${milestone.title}`}
                    fields={[
                      {
                        name: 'title',
                        label: 'Title',
                        value: milestone.title,
                        required: true,
                      },
                      {
                        name: 'description',
                        label: 'Description',
                        value: milestone.description,
                        multiline: true,
                        maxLength: 32768,
                      },
                      dueDateField(milestone.dueDate ?? ''),
                      {
                        name: 'state',
                        label: 'State',
                        value: milestone.state,
                        options: ['open', 'closed'],
                      },
                    ]}
                    onSave={(value) =>
                      changed(
                        api.request(
                          'PATCH /api/v1/projects/{projectId}/milestones/{milestoneId}',
                          {
                            params: { projectId, milestoneId: milestone.id },
                            body: {
                              expectedRevision: milestone.revision,
                              title: value.title!,
                              description: value.description!,
                              dueDate: value.dueDate || null,
                              state: value.state as 'open' | 'closed',
                            },
                          },
                        ),
                      )
                    }
                  />
                  <CommandForm
                    label={`Delete milestone ${milestone.title}`}
                    confirm
                    fields={[]}
                    onSave={() =>
                      changed(
                        api.request(
                          'DELETE /api/v1/projects/{projectId}/milestones/{milestoneId}',
                          {
                            params: { projectId, milestoneId: milestone.id },
                            body: {},
                          },
                        ),
                      )
                    }
                  />
                </section>
              ))}
            </details>
            <details>
              <summary>Issue Forms</summary>
              <QueryStatus query={forms} />
              <p>
                Use the supported GitHub YAML subset. Replacement creates a new
                immutable version.
              </p>
              <CommandForm
                label="Create Issue Form"
                fields={[
                  {
                    name: 'source',
                    label: 'YAML definition',
                    required: true,
                    multiline: true,
                    maxLength: 65536,
                  },
                  {
                    name: 'enabled',
                    label: 'Enabled',
                    value: 'true',
                    options: ['true', 'false'],
                  },
                ]}
                onSave={(value) =>
                  changed(
                    api.request('POST /api/v1/projects/{projectId}/forms', {
                      params: { projectId },
                      body: {
                        format: 'yaml',
                        source: value.source!,
                        enabled: value.enabled === 'true',
                      },
                    }),
                  )
                }
              />
              {formsData?.items.map((form) => (
                <section key={form.id}>
                  <h2>
                    {form.name} · revision {form.revision}
                  </h2>
                  <CommandForm
                    label={`Replace form ${form.name}`}
                    confirm
                    fields={[
                      {
                        name: 'source',
                        label: 'Replacement YAML definition',
                        required: true,
                        multiline: true,
                        maxLength: 65536,
                      },
                      {
                        name: 'enabled',
                        label: 'Enabled',
                        value: String(form.enabled),
                        options: ['true', 'false'],
                      },
                    ]}
                    onSave={(value) =>
                      changed(
                        api.request(
                          'PUT /api/v1/projects/{projectId}/forms/{definitionId}',
                          {
                            params: { projectId, definitionId: form.id },
                            body: {
                              expectedRevision: form.revision,
                              format: 'yaml',
                              source: value.source!,
                              enabled: value.enabled === 'true',
                            },
                          },
                        ),
                      )
                    }
                  />
                </section>
              ))}
            </details>
            <details>
              <summary>Markdown templates</summary>
              <QueryStatus query={templates} />
              <CommandForm
                label="Create template"
                fields={[
                  { name: 'name', label: 'Template name', required: true },
                  {
                    name: 'body',
                    label: 'Markdown content',
                    multiline: true,
                    required: true,
                  },
                ]}
                onSave={(value) =>
                  changed(
                    api.request('POST /api/v1/projects/{projectId}/templates', {
                      params: { projectId },
                      body: {
                        name: value.name!,
                        body: value.body!,
                        enabled: true,
                      },
                    }),
                  )
                }
              />
              {templatesData?.items.map((template) => (
                <section key={template.id}>
                  <h2>
                    {template.name} · revision {template.revision}
                  </h2>
                  <CommandForm
                    label={`Replace template ${template.name}`}
                    confirm
                    fields={[
                      {
                        name: 'name',
                        label: 'Name',
                        value: template.name,
                        required: true,
                      },
                      {
                        name: 'body',
                        label: 'Replacement Markdown',
                        multiline: true,
                        required: true,
                      },
                      {
                        name: 'enabled',
                        label: 'Enabled',
                        value: String(template.enabled),
                        options: ['true', 'false'],
                      },
                    ]}
                    onSave={(value) =>
                      changed(
                        api.request(
                          'PUT /api/v1/projects/{projectId}/templates/{definitionId}',
                          {
                            params: { projectId, definitionId: template.id },
                            body: {
                              expectedRevision: template.revision,
                              name: value.name!,
                              body: value.body!,
                              enabled: value.enabled === 'true',
                            },
                          },
                        ),
                      )
                    }
                  />
                </section>
              ))}
            </details>
            <button type="button" onClick={() => setShowAudit(true)}>
              Browse project audit trail (Administrator)
            </button>
            {showAudit ? (
              <Suspense fallback={<output>Loading audit view…</output>}>
                <Audit projectId={projectId} />
              </Suspense>
            ) : null}
            <details>
              <summary>Staff roles</summary>
              <p>
                Use an existing Staff principal ID. Public User accounts cannot
                receive Staff privileges.
              </p>
              <CommandForm
                label="Set Staff role"
                confirm
                fields={[
                  {
                    name: 'principalId',
                    label: 'Staff principal ID',
                    required: true,
                    maxLength: 36,
                  },
                  {
                    name: 'role',
                    label: 'Project role',
                    value: 'triage',
                    options: ['triage', 'maintainer', 'administrator'],
                  },
                ]}
                onSave={(value) =>
                  changed(
                    api.request(
                      'PUT /api/v1/projects/{projectId}/members/{principalId}',
                      {
                        params: { projectId, principalId: value.principalId! },
                        body: {
                          role: value.role as
                            | 'triage'
                            | 'maintainer'
                            | 'administrator',
                        },
                      },
                    ),
                  )
                }
              />
              <CommandForm
                label="Remove Staff membership"
                confirm
                fields={[
                  {
                    name: 'principalId',
                    label: 'Staff principal ID',
                    required: true,
                    maxLength: 36,
                  },
                ]}
                onSave={(value) =>
                  changed(
                    api.request(
                      'DELETE /api/v1/projects/{projectId}/members/{principalId}',
                      {
                        params: { projectId, principalId: value.principalId! },
                        body: {},
                      },
                    ),
                  )
                }
              />
            </details>
          </fieldset>
        </>
      )}
    </>
  );
}
