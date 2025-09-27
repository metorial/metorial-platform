import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderOauthDiscoverOutput = {
  object: 'provider_oauth.discovery';
  id: string;
  providerName: string;
  providerUrl: string;
  config: Record<string, any>;
  createdAt: Date;
  refreshedAt: Date;
  autoRegistrationId: string | null;
};

export let mapProviderOauthDiscoverOutput =
  mtMap.object<ProviderOauthDiscoverOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    providerName: mtMap.objectField('provider_name', mtMap.passthrough()),
    providerUrl: mtMap.objectField('provider_url', mtMap.passthrough()),
    config: mtMap.objectField('config', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    refreshedAt: mtMap.objectField('refreshed_at', mtMap.date()),
    autoRegistrationId: mtMap.objectField(
      'auto_registration_id',
      mtMap.passthrough()
    )
  });

export type ProviderOauthDiscoverBody = {
  discoveryUrl: string;
  clientName: string;
};

export let mapProviderOauthDiscoverBody =
  mtMap.object<ProviderOauthDiscoverBody>({
    discoveryUrl: mtMap.objectField('discovery_url', mtMap.passthrough()),
    clientName: mtMap.objectField('client_name', mtMap.passthrough())
  });

