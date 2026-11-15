import { createClient } from '@lowerdeck/rpc-client';
import type { AuthClient } from '@mtsrc/auth-core-api-auth/src/controllers';

export let authClient = createClient<AuthClient>({
  endpoint: `${location.origin}/metorial-ares/auth-api`,
  disableBatching: true,
  useDirectMethodRoute: true
});

export type IAuthIntent = Awaited<ReturnType<AuthClient['authIntent']['get']>>;
