import { ensureProviderOAuthConfig, Instance, ProviderOAuthConfig } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Hash } from '@metorial/hash';
import { Service } from '@metorial/service';
import { OAuthUtils } from '../lib/oauthUtils';
import { configAutoDiscoveryQueue } from '../queue/configAutoDiscovery';
import { OAuthConfiguration, oauthConfigValidator } from '../types';

class OauthConfigServiceImpl {
  async createConfig(d: {
    instance: Instance;
    implementation:
      | {
          type: 'json';
          config: OAuthConfiguration;
          scopes: string[];
        }
      | {
          type: 'managed_server_http';
          httpEndpoint: string;
          hasRemoteOauthForm: boolean;
          lambdaServerInstanceOid: bigint;
        };
  }) {
    if (d.implementation.type === 'json') {
      let valRes = oauthConfigValidator.validate(d.implementation.config);
      if (!valRes.success) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid OAuth configuration',
            details: valRes.errors
          })
        );
      }
    }

    let config = await ensureProviderOAuthConfig(
      async () => ({
        configHash:
          d.implementation.type == 'json'
            ? await OAuthUtils.getConfigHash(d.implementation.config, d.implementation.scopes)
            : await Hash.sha256(d.implementation.type + d.implementation.httpEndpoint),

        scopes: d.implementation.type == 'json' ? d.implementation.scopes : [],
        config: d.implementation.type == 'json' ? d.implementation.config : {},

        httpEndpoint:
          d.implementation.type == 'managed_server_http'
            ? d.implementation.httpEndpoint
            : null,
        hasRemoteOauthForm:
          d.implementation.type == 'managed_server_http'
            ? d.implementation.hasRemoteOauthForm
            : null,
        lambdaServerInstanceForHttpEndpointOid:
          d.implementation.type == 'managed_server_http'
            ? d.implementation.lambdaServerInstanceOid
            : null,

        instanceOid: d.instance.oid,
        discoverStatus: 'discovering',
        type: d.implementation.type
      }),
      {
        ignoreForUpdate: ['discoverStatus']
      }
    );

    if (config.discoverStatus == 'discovering') {
      await configAutoDiscoveryQueue.add({
        configId: config.id
      });
    }

    return config;
  }

  async cloneConfig(d: { instance: Instance; config: ProviderOAuthConfig }) {
    return this.createConfig({
      instance: d.instance,
      implementation:
        d.config.type === 'json'
          ? {
              type: 'json' as const,
              config: d.config.config as OAuthConfiguration,
              scopes: d.config.scopes
            }
          : {
              type: 'managed_server_http' as const,
              httpEndpoint: d.config.httpEndpoint!,
              hasRemoteOauthForm: d.config.hasRemoteOauthForm!,
              lambdaServerInstanceOid: d.config.lambdaServerInstanceForHttpEndpointOid!
            }
    });
  }
}

export let providerOauthConfigService = Service.create(
  'providerOauthConfig',
  () => new OauthConfigServiceImpl()
).build();
