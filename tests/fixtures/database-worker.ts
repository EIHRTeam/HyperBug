import type { D1Database } from '@cloudflare/workers-types';
import { createD1Repository } from '@hyperbug/database-d1';
import { DomainError } from '@hyperbug/domain';
import type {
  CreateIssueIntent,
  EditIssueIntent,
  IssueListQuery,
} from '@hyperbug/application';

type Message =
  | { method: 'createIssue'; input: CreateIssueIntent }
  | { method: 'editIssue'; input: EditIssueIntent }
  | { method: 'getIssue'; input: { projectId: string; id: string } }
  | { method: 'listIssues'; input: IssueListQuery };

// Internal loopback test transport. Never included in production entry points.
export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    const queries: string[] = [];
    const measured = {
      prepare(sql: string) {
        queries.push(sql);
        return env.DB.prepare(sql);
      },
      batch: env.DB.batch.bind(env.DB),
    };
    const repository = createD1Repository(measured as unknown as D1Database);
    const message = (await request.json()) as Message;
    try {
      let value: unknown;
      switch (message.method) {
        case 'createIssue':
          value = await repository.createIssue(message.input);
          break;
        case 'editIssue':
          value = await repository.editIssue(message.input);
          break;
        case 'getIssue':
          value = await repository.getIssue(
            message.input.projectId,
            message.input.id,
          );
          break;
        case 'listIssues':
          value = await repository.listIssues(message.input);
          break;
        default:
          return new Response(null, { status: 400 });
      }
      return Response.json({ value, queries });
    } catch (error) {
      return Response.json(
        {
          error: {
            code:
              error instanceof DomainError ? error.code : 'PERSISTENCE_FAILURE',
          },
          queries,
        },
        { status: 500 },
      );
    }
  },
};
