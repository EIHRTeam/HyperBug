import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { newIssueRoute, useAuth } from '../app.tsx';
import { useProductApi, useProductQuery } from '../product-api.ts';
import { ProjectNav, QueryStatus } from '../components/product.tsx';
import { ContentEditor } from '../components/editor.tsx';
import { Markdown } from '../components/markdown.tsx';
import { projectIdPattern } from '../product-state.ts';
import { IssueForm } from '../components/issue-form.tsx';

export function NewIssue() {
  const { projectId } = newIssueRoute.useParams();
  const navigate = newIssueRoute.useNavigate();
  const { auth, state } = useAuth();
  const api = useProductApi();
  const queries = useQueryClient();
  const [templateId, setTemplateId] = useState('');
  const [formId, setFormId] = useState('');
  const [formDraftGeneration, setFormDraftGeneration] = useState(0);
  const valid = projectIdPattern.test(projectId);
  const templates = useProductQuery(
    'GET /api/v1/projects/{projectId}/templates',
    { params: { projectId } },
    valid,
  );
  const forms = useProductQuery(
    'GET /api/v1/projects/{projectId}/forms',
    { params: { projectId } },
    valid,
  );
  const form = useProductQuery(
    'GET /api/v1/projects/{projectId}/forms/{definitionId}',
    { params: { projectId, definitionId: formId } },
    valid && Boolean(formId),
  );
  const template = useProductQuery(
    'GET /api/v1/projects/{projectId}/templates/{definitionId}',
    { params: { projectId, definitionId: templateId } },
    valid && Boolean(templateId),
  );
  if (!valid) return <h1>Invalid project address</h1>;
  return (
    <>
      <h1>Submit feedback</h1>
      <ProjectNav projectId={projectId} />
      {!state.account ? (
        <>
          <p>
            Sign in to submit an issue. Browsing public feedback does not
            require an account.
          </p>
          <button
            type="button"
            onClick={() => {
              void auth.signIn();
            }}
          >
            Sign in
          </button>
        </>
      ) : (
        <>
          <QueryStatus query={templates} />
          <QueryStatus query={forms} />
          <div className="field">
            <label htmlFor="form-choice">Submission format</label>
            <select
              id="form-choice"
              value={formId}
              onChange={(event) => setFormId(event.target.value)}
            >
              <option value="">Markdown issue</option>
              {forms.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {formId ? (
            <>
              <QueryStatus query={form} />
              <button
                type="button"
                disabled={form.isFetching}
                onClick={async () => {
                  const latest = await form.refetch();
                  if (latest.isSuccess)
                    setFormDraftGeneration((value) => value + 1);
                }}
              >
                Discard form draft and reload latest definition
              </button>
              {form.data ? (
                <IssueForm
                  key={`${formId}:${form.data.version}:${formDraftGeneration}`}
                  document={form.data}
                  onSave={async (body, key) => {
                    const issue = await api.request(
                      'POST /api/v1/projects/{projectId}/forms/{definitionId}/submissions',
                      {
                        params: { projectId, definitionId: formId },
                        body,
                        idempotencyKey: key,
                        retryMutation: true,
                      },
                    );
                    await queries.invalidateQueries({
                      queryKey: ['product', api.origin, state.epoch],
                    });
                    await navigate({
                      to: '/projects/$projectId/issues/$issueId/$number',
                      params: {
                        projectId,
                        issueId: issue.id,
                        number: String(issue.number),
                      },
                      search: { cursor: '', comment: '' },
                    });
                  }}
                />
              ) : null}
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="template">Issue template</label>
                <select
                  id="template"
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                >
                  <option value="">Blank issue</option>
                  {templates.data?.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              {templateId ? <QueryStatus query={template} /> : null}
              {template.data ? (
                <details>
                  <summary>Template preview</summary>
                  <Markdown
                    tree={template.data.bodyTree}
                    version={template.data.contentPolicyVersion}
                  />
                </details>
              ) : null}
              {!templateId || template.data ? (
                <ContentEditor
                  projectId={projectId}
                  key={`${templateId}:${template.data?.version ?? 0}`}
                  titleLabel="Issue title"
                  initialBody={templateId ? (template.data?.body ?? '') : ''}
                  submitLabel="Create issue"
                  onSave={async (value, key) => {
                    const issue = await api.request(
                      'POST /api/v1/projects/{projectId}/issues',
                      {
                        params: { projectId },
                        body: value,
                        idempotencyKey: key,
                        retryMutation: true,
                      },
                    );
                    await queries.invalidateQueries({
                      queryKey: ['product', api.origin, state.epoch],
                    });
                    await navigate({
                      to: '/projects/$projectId/issues/$issueId/$number',
                      params: {
                        projectId,
                        issueId: issue.id,
                        number: String(issue.number),
                      },
                      search: { cursor: '', comment: '' },
                    });
                  }}
                />
              ) : null}
            </>
          )}
        </>
      )}
    </>
  );
}
