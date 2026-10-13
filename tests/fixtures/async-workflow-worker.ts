import type { D1Database, Workflow } from '@cloudflare/workers-types';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowReference } from '@hyperbug/application';
import {
  HyperBugWorkflow,
  createCloudflareWorkflowAdapter,
  d1JobStore,
} from '../../apps/api-cloudflare/src/workflow.ts';

/** Actual platform steps, with a one-time crash after the database commit. */
export class CrashWorkflow extends HyperBugWorkflow {
  override run(event: WorkflowEvent<WorkflowReference>, step: WorkflowStep) {
    const wrapped = new Proxy(step, {
      get: (target, key) => {
        if (key !== 'do') return Reflect.get(target, key);
        return (
          name: string,
          config: Parameters<WorkflowStep['do']>[1],
          callback: () => Promise<{ checkpoint: number; terminal: boolean }>,
        ) =>
          target.do(name, config, async () => {
            const result = await callback();
            if (name === 'checkpoint-0') {
              const inserted = await this.env.DB.prepare(
                'INSERT INTO workflow_crashes (id) VALUES (?) ON CONFLICT DO NOTHING RETURNING id',
              )
                .bind(event.payload.jobId)
                .all();
              if (inserted.results.length)
                throw new Error('Injected commit-before-step-result crash');
            }
            return result;
          });
      },
    });
    return super.run(event, wrapped);
  }
}
export default {
  async fetch(
    request: Request,
    env: { DB: D1Database; FLOW: Workflow<WorkflowReference> },
  ) {
    const url = new URL(request.url),
      id = url.searchParams.get('id')!;
    const store = d1JobStore(env.DB),
      adapter = createCloudflareWorkflowAdapter(store, env.FLOW);
    if (request.method === 'POST') {
      if (url.pathname === '/start') await adapter.start(id, 2);
      if (url.pathname === '/resume') await adapter.resume(id);
      if (url.pathname === '/cancel') await adapter.cancel(id);
      if (url.pathname === '/terminate')
        await (await env.FLOW.get(id)).terminate();
      return new Response('ok');
    }
    return Response.json({
      job: await store.get(id),
      status: await (await env.FLOW.get(id)).status(),
    });
  },
};
