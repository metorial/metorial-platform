import { createAresInternalClient } from '@metorial-platform-systems/ares-client';
import { env } from './env';

export let aresClient: ReturnType<typeof createAresInternalClient> | null = env.ares
  .ARES_AUTH_URL
  ? createAresInternalClient({
      endpoint: `${env.ares.ARES_AUTH_URL}/metorial-ares/auth-api`
    })
  : null;
