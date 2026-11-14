import { createCodeBucketClient } from '@mtsrc/scm-code-bucket-client-internal';
import { env } from '../env';

export let codeBucketClient: any = createCodeBucketClient({
  address: env.codeBucket.CODE_BUCKET_SERVICE_URL
});
