import { perEdition } from '@metorial/editions';
import { domainSettings } from '@metorial/shared-settings';

export let aresCorsDomains = () => [
  ...domainSettings().apps,
  ...domainSettings().dev,
  ...perEdition<string[]>({
    cloud: ['localhost', 'metorial.test', 'metorial.work'],
    'on-prem': []
  }),
  ...(process.env.CORS_DOMAINS?.split(',').map(domain => domain.trim()) ?? [])
];
