import { createClient } from '@lowerdeck/rpc-client';
import { getConfig } from '@metorial/config';

export let subspace = createClient({
  url: getConfig().subspaceUrl
});
