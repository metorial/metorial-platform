import { createOriginClient } from '@metorial-platform-systems/origin-client';
import { env } from '../env';

export let origin: ReturnType<typeof createOriginClient> = createOriginClient({
  endpoint: env.origin.ORIGIN_URL
});
