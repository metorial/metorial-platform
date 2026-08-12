import { createClient } from '@lowerdeck/rpc-client';
import type { IntegrationsClient } from '@metorial/api-integrations';

let getIntegrationsApiUrl = () => {
  let runtimeConfigElement = document.querySelector('#runtime-config');
  if (runtimeConfigElement?.textContent) {
    try {
      let config = JSON.parse(runtimeConfigElement.textContent) as {
        integrationsApiUrl?: string;
      };
      if (config.integrationsApiUrl) return config.integrationsApiUrl.replace(/\/$/, '');
    } catch {}
  }

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return `${location.protocol}//${location.hostname}:4316`;
  }

  return location.origin;
};

export let client = createClient<IntegrationsClient>({
  endpoint: `${getIntegrationsApiUrl()}/subspace-public/internal-api`
});
