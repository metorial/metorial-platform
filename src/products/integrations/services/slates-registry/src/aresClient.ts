import { createAresInternalClient } from '@mtsrc/auth-core-client-internal';
import { env } from './env';

export let aresClient: ReturnType<typeof createAresInternalClient> | null = env.ares
  .ARES_AUTH_URL
  ? createAresInternalClient({
      endpoint: `${env.ares.ARES_AUTH_URL}/metorial-ares/auth-api`
    })
  : null;
