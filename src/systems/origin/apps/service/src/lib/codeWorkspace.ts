import { createCodeBucketClient } from '@metorial/code-bucket-service-generated';
import { env } from '../env';

export let codeBucketClient: any = createCodeBucketClient({
  address: env.codeBucket.CODE_BUCKET_SERVICE_URL
});
