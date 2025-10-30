import { ensureProviderOAuthConfig, Instance, ProviderOAuthConfig } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Hash } from '@metorial/hash';
import { Service } from '@metorial/service';
import { OAuthUtils } from '../lib/oauthUtils';
import { configAutoDiscoveryQueue } from '../queue/configAutoDiscovery';
import { OAuthConfiguration, oauthConfigValidator } from '../types';

type OAuthConfigImplementation =
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
    }
  | {
      type: 'managed_server_lambda';
      lambdaServerInstanceOid: bigint;
      hasRemoteOauthForm: boolean;
    };

class OauthConfigServiceImpl {
  async createConfig(d: { instance: Instance; implementation: OAuthConfigImplementation }) {
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

    console.log('Creating OAuth config with implementation:', d.implementation);

    let config = await ensureProviderOAuthConfig(
      async () => ({
        configHash:
          d.implementation.type == 'json'
            ? await OAuthUtils.getConfigHash(d.implementation.config, d.implementation.scopes)
            : await Hash.sha256(
                d.implementation.type + d.implementation.lambdaServerInstanceOid
              ),

        scopes: d.implementation.type == 'json' ? d.implementation.scopes : [],
        config: d.implementation.type == 'json' ? d.implementation.config : {},

        httpEndpoint:
          d.implementation.type == 'managed_server_http'
            ? d.implementation.httpEndpoint
            : null,

        hasRemoteOauthForm:
          d.implementation.type == 'json' ? null : d.implementation.hasRemoteOauthForm,
        lambdaServerInstanceForManagedServerOid:
          d.implementation.type == 'json' ? null : d.implementation.lambdaServerInstanceOid,

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
    let implementation: OAuthConfigImplementation;

    switch (d.config.type) {
      case 'json':
        implementation = {
          type: 'json',
          config: d.config.config as OAuthConfiguration,
          scopes: d.config.scopes
        };
        break;

      case 'managed_server_http':
        implementation = {
          type: 'managed_server_http',
          httpEndpoint: d.config.httpEndpoint!,
          hasRemoteOauthForm: d.config.hasRemoteOauthForm!,
          lambdaServerInstanceOid: d.config.lambdaServerInstanceForManagedServerOid!
        };
        break;

      case 'managed_server_lambda':
        implementation = {
          type: 'managed_server_lambda',
          lambdaServerInstanceOid: d.config.lambdaServerInstanceForManagedServerOid!,
          hasRemoteOauthForm: d.config.hasRemoteOauthForm!
        };
        break;

      default:
        throw new Error(`Unsupported OAuth config type: ${d.config.type}`);
    }

    console.log('Cloning OAuth config with implementation:', d.config, implementation);

    return this.createConfig({
      instance: d.instance,
      implementation
    });
  }
}

export let providerOauthConfigService = Service.create(
  'providerOauthConfig',
  () => new OauthConfigServiceImpl()
).build();
