import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { setting } from '@metorial/settings';
import { installationSettings } from './installation';

type LazyDefault<T = string> = T | undefined | (() => T | undefined);

export let metorialEnv = setting(v.enumOf(['development', 'staging', 'production']), {
  env: 'METORIAL_ENV',
  default: perEdition<LazyDefault<'production'>>({ cloud: undefined, 'on-prem': 'production' })
});

export let metorialRegion = setting(v.optional(v.string()), { env: 'METORIAL_REGION' });

export let publicUrls = {
  apiUrl: setting(v.string(), { env: 'API_URL' }),
  filesUrl: setting(v.string(), { env: 'FILES_URL' }),
  portalsUrl: setting(v.string(), { env: 'PORTALS_URL' }),

  appUrl: setting(v.string(), {
    env: 'APP_URL',
    audience: 'derived',
    description: 'URL of the dashboard, defaults to the installation URL on-prem',
    default: perEdition<LazyDefault>({
      cloud: undefined,
      'on-prem': () => installationSettings().publicUrl
    })
  }),

  publicMcpUrl: setting(v.optional(v.string()), {
    env: 'PUBLIC_MCP_URL',
    editions: ['cloud'],
    description: 'Base URL public MCP servers are served from'
  })
};
