import { createClient } from '@lowerdeck/rpc-client';
import type { AuthClient } from '../../../../src/apis/auth/controllers';

export let authClient = createClient<AuthClient>({
  endpoint: `${location.origin}/metorial-ares/auth-api`
});

export type IAuthIntent = Awaited<ReturnType<AuthClient['authIntent']['get']>>;
