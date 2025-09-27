import { createCodeBucketClient } from '@metorial/code-bucket-service-generated';
import { env } from '../env';

export let codeWorkspaceClient = createCodeBucketClient({
  address: env.codeWorkspace.CODE_WORKSPACE_SERVICE_ADDRESS
});
