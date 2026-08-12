import { createClient } from '@lowerdeck/rpc-client';
import type { IntegrationsClient } from '@metorial/api-integrations';

let getIntegrationsApiUrl = () => {
  let integrationsApiUrl = import.meta.env.VITE_INTEGRATIONS_API_URL;
  if (!integrationsApiUrl) {
    throw new Error('VITE_INTEGRATIONS_API_URL is required');
  }

  return integrationsApiUrl.replace(/\/$/, '');
};

export let client = createClient<IntegrationsClient>({
  endpoint: `${getIntegrationsApiUrl()}/subspace-public/internal-api`
});
