import { defineSettings, setting } from '@metorial/settings';
import { perEdition } from '@metorial/editions';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    SSO_DATABASE_URL: v.string(),
    ARES_AUTH_URL: v.string(),
    ARES_SSO_URL: v.string(),
    SSO_DATABASE_SSL: v.optional(v.string())
  },

  sso: {
    SAML_AUDIENCE: v.string()
  }
});

export let ssoNetworkSettings = defineSettings('ssoNetwork', {
  allowPrivateNetworks: setting(v.boolean(), {
    env: 'SSO_ALLOW_PRIVATE_NETWORKS',
    default: perEdition<boolean | (() => boolean)>({
      cloud: () => process.env.METORIAL_ENV == 'development',
      'on-prem': true
    }),
    description:
      'Allow SAML metadata and OIDC discovery URLs on private, loopback or link-local addresses'
  })
});
