import { ensureProviderOAuthConfig, Instance } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { OAuthUtils } from '../lib/oauthUtils';
import { configAutoDiscoveryQueue } from '../queue/configAutoDiscovery';
import { OAuthConfiguration, oauthConfigValidator } from '../types';

class OauthConfigServiceImpl {
  async createConfig(d: { instance: Instance; config: OAuthConfiguration; scopes: string[] }) {
    let valRes = oauthConfigValidator.validate(d.config);
    if (!valRes.success) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid OAuth configuration',
          details: valRes.errors
        })
      );
    }

    let config = await ensureProviderOAuthConfig(
      async () => ({
        scopes: d.scopes,
        instanceOid: d.instance.oid,
        config: d.config as any,
        configHash: await OAuthUtils.getConfigHash(d.config, d.scopes),
        discoverStatus: 'discovering'
      }),
      {
        ignoreForUpdate: ['discoverStatus']
      }
    );

    await configAutoDiscoveryQueue.add({
      configId: config.id
    });

    return config;
  }
}

export let providerOauthConfigService = Service.create(
  'providerOauthConfig',
  () => new OauthConfigServiceImpl()
).build();
