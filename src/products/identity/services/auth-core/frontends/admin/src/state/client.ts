import { createClient } from '@lowerdeck/rpc-client';
import type { AdminClient } from '@mtsrc/auth-core-api-admin/src/controllers';

export let adminClient = createClient<AdminClient>({
  endpoint: `${location.origin}/metorial-ares-admin/api`
});
