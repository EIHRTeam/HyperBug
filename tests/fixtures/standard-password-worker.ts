import {
  createCloudflareArgon2idProvider,
  createCloudflareStandardPasswordService,
} from '../../apps/api-cloudflare/src/standard-password.ts';
import {
  loadDeploymentConfig,
  type DeploymentConfig,
} from '../../packages/config/src/deployment.ts';
import { createD1AccountRegistrationStore } from '@hyperbug/database-d1';
import type { D1Database } from '@cloudflare/workers-types';
import {
  observeStandardPasswordRehash,
  rehashInitialParameters,
  rehashSupersededParameters,
} from './standard-password-rehash-contract.ts';

const provider = createCloudflareArgon2idProvider(19456);
const deployment = loadDeploymentConfig({}, 'cloudflare');
const minimum = loadDeploymentConfig(
  {
    HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-free-minimum',
    HYPERBUG_DEGRADATION_ACK: 'free-minimum-v1',
  },
  'cloudflare',
);
const policy = {
  current: { memoryKiB: 19456, passes: 2, parallelism: 1 },
  maximum: { memoryKiB: 19456, passes: 2, parallelism: 1 },
};
const service = createCloudflareStandardPasswordService(
  deployment,
  policy,
  19456,
);

function rejectsPolicy(
  maximum: typeof policy.maximum,
  tier: DeploymentConfig = deployment,
): boolean {
  try {
    createCloudflareStandardPasswordService(
      tier,
      { current: policy.current, maximum },
      19456,
    );
    return false;
  } catch {
    return true;
  }
}

export default {
  async fetch(
    request: Request,
    env: { NODE_RECORD?: string; REHASH_DB?: D1Database },
  ): Promise<Response> {
    if (new URL(request.url).pathname === '/policy')
      return Response.json({
        deniedMemory: rejectsPolicy({ ...policy.maximum, memoryKiB: 32768 }),
        deniedParallelism: rejectsPolicy({ ...policy.maximum, parallelism: 2 }),
        deniedMinimumTier: rejectsPolicy(policy.maximum, minimum),
      });
    if (new URL(request.url).pathname === '/rehash') {
      // 03.2e conformance: the real Workers provider rehashes a superseded
      // record through the actual login operation against a primary D1 store.
      if (!env.REHASH_DB) return Response.json({}, { status: 500 });
      const observation = await observeStandardPasswordRehash({
        store: createD1AccountRegistrationStore(env.REHASH_DB),
        initialService: createCloudflareStandardPasswordService(
          deployment,
          {
            current: rehashInitialParameters,
            maximum: rehashInitialParameters,
          },
          rehashInitialParameters.memoryKiB,
        ),
        supersededService: createCloudflareStandardPasswordService(
          deployment,
          {
            current: rehashSupersededParameters,
            maximum: rehashSupersededParameters,
          },
          rehashSupersededParameters.memoryKiB,
        ),
        password: 'test password',
        nowMs: 1789900800000,
      });
      return Response.json(observation);
    }
    if (new URL(request.url).pathname === '/exchange') {
      const fromNode = await service.verify(
        'test password',
        JSON.parse(env.NODE_RECORD ?? 'null'),
      );
      const workerRecord = await service.hash('test password');
      return Response.json({
        nodeVerified: fromNode.verified,
        nodeReplacement: fromNode.replacement,
        workerRecord,
      });
    }
    const password = new TextEncoder().encode('test password');
    const salt = new TextEncoder().encode('0123456789abcdef');
    const parameters = { memoryKiB: 19456, passes: 2, parallelism: 1 };
    let stage = 'derive';
    try {
      const result = await provider.derive(password, salt, parameters);
      stage = 'match';
      const hex = Array.from(result, (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      const correct = await provider.matches(
        password,
        salt,
        result,
        parameters,
      );
      stage = 'wrong';
      const wrong = Uint8Array.from(result);
      wrong[0] = (wrong[0] ?? 0) ^ 1;
      const incorrect = await provider.matches(
        password,
        salt,
        wrong,
        parameters,
      );
      stage = 'parallelism';
      wrong.fill(0);
      result.fill(0);
      let deniedParallelism = false;
      try {
        await provider.derive(password, salt, {
          ...parameters,
          parallelism: 2,
        });
      } catch {
        deniedParallelism = true;
      }
      return Response.json({ hex, correct, incorrect, deniedParallelism });
    } catch {
      return Response.json({ stage }, { status: 500 });
    } finally {
      password.fill(0);
      salt.fill(0);
    }
  },
};
