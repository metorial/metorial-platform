import { createOriginClient } from '@mtsrc/scm-client-internal';
import { env } from '../env';

export let origin: ReturnType<typeof createOriginClient> = createOriginClient({
  endpoint: env.origin.ORIGIN_URL
});
