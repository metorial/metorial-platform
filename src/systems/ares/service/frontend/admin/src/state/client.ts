import { createClient } from '@mtsrc/rpc-client';
import type { AdminClient } from '../../../../src/apis/admin/controllers';

export let adminClient = createClient<AdminClient>({
  endpoint: `${location.origin}/metorial-ares-admin/api`
});
