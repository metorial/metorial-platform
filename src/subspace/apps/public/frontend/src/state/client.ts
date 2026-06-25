import { createClient } from '@lowerdeck/rpc-client';
import type { SubspaceFrontendClient } from '../../../src/api/internal';

export let client = createClient<SubspaceFrontendClient>({
  endpoint: `${location.origin}/subspace-public/internal-api`
});
