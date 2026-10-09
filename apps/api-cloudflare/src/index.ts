import { env } from 'cloudflare:workers';
import { createCloudflareApi } from './composition.ts';
import { createCloudflareStandardPasswordService } from './standard-password.ts';
import { initialStandardPasswordPolicy } from '@hyperbug/security';

export default createCloudflareApi(env, (deployment) =>
  createCloudflareStandardPasswordService(
    deployment,
    initialStandardPasswordPolicy,
    initialStandardPasswordPolicy.maximum.memoryKiB,
  ),
);

export { HyperBugWorkflow } from './workflow.ts';
