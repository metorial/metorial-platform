import { providerApiController } from './controllers';
import { restServer } from './rest';

export let providerApp = restServer.launch({
  versions: {
    provider_2025_01: {
      displayVersion: '2025-01',
      apiVersion: 'provider_2025_01',
      alternativeIdentifiers: ['provider', '2025-01'],
      controller: providerApiController
    }
  },
  currentVersion: 'provider_2025_01'
});
