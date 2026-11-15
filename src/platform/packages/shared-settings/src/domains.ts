import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';
import { installationSettings } from './installation';
import { once } from './once';

type LazyDomains = string[] | (() => string[]);

let installationHost = () => {
  let publicUrl = installationSettings().publicUrl;

  return publicUrl ? [new URL(publicUrl).hostname] : [];
};

let loadDomains = once(() =>
  defineSettings('domains', {
    apps: setting.list(v.string(), {
      env: 'METORIAL_APP_DOMAINS',
      audience: 'derived',
      description:
        'Domains of the first party web apps (dashboard, auth, portals). Origins on these domains are trusted for CORS',
      default: perEdition<LazyDomains>({
        cloud: ['metorial.com', 'metorial.app', 'metorial.cloud'],
        'on-prem': installationHost
      })
    }),

    owned: setting.list(v.string(), {
      env: 'METORIAL_OWNED_DOMAINS',
      audience: 'derived',
      description:
        'All domains operated by this installation. Links and images on them are treated as first party',
      default: perEdition<LazyDomains>({
        cloud: [
          'metorial.com',
          'metorial.net',
          'metorial.dev',
          'metorial.app',
          'metorial.cloud',
          'metorial.io',
          'metorial.ai',
          'metorial-enterprise.com'
        ],
        'on-prem': installationHost
      })
    }),

    assets: setting.list(v.string(), {
      env: 'METORIAL_ASSET_DOMAINS',
      audience: 'derived',
      description: 'Domains images, files and other static assets are served from',
      default: perEdition<LazyDomains>({
        cloud: ['metorial-cdn.com', 'metorial-files.com'],
        'on-prem': installationHost
      })
    }),

    dev: setting.list(v.string(), {
      env: 'METORIAL_DEV_HOSTS',
      description: 'Hosts that are only trusted while developing locally',
      default: () => (process.env.METORIAL_ENV == 'development' ? ['localhost'] : [])
    })
  })
);

export let domainSettings = () => loadDomains();

export let matchesDomain = (hostname: string, domains: readonly string[]) => {
  let host = hostname.toLowerCase();

  return domains.some(domain => {
    let normalized = domain.toLowerCase().replace(/^\./, '');
    return host === normalized || host.endsWith(`.${normalized}`);
  });
};

let developmentOrigins = perEdition<string[]>({
  cloud: ['localhost', 'metorial.test'],
  'on-prem': []
});

let extraTrustedDomains = perEdition<string[]>({
  cloud: ['metorial-staging.com', 'metorial-internal.com'],
  'on-prem': []
});

export let trustedOriginDomains = () => [
  ...extraTrustedDomains,
  ...domainSettings().apps,
  ...(process.env.CORS_DOMAINS?.split(',').map(domain => domain.trim()) ?? [])
];

export let corsDomains = () => [...developmentOrigins, ...trustedOriginDomains()];
