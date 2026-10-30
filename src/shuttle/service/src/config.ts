import { perEdition } from '@metorial/editions';
import { env } from './env';

export let oauthCallbackUrl = `${env.service.PROVIDER_OAUTH_URL}/shuttle-oauth/callback`;

export let clientBranding = perEdition<Record<string, string>>({
  cloud: {
    logo_uri:
      'https://cdn.metorial.com/2026-10-19--15-18-47/logos/metorial/logo_blue_bg/resized-100-w512-h512.png',
    client_uri: 'https://metorial.com',
    tos_uri: 'https://metorial.com/legal',
    policy_uri: 'https://metorial.com/legal'
  },
  'on-prem': {
    client_uri: env.service.PROVIDER_OAUTH_URL
  }
});
