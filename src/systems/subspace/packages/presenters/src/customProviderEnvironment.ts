import type {
  CustomProvider,
  CustomProviderEnvironment,
  Environment,
  Provider,
  ProviderEnvironment,
  ProviderVersion
} from '@metorial-subspace/db';

export let customProviderEnvironmentPresenter = (
  customProviderEnvironment: CustomProviderEnvironment & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };
    environment: Environment;
    providerEnvironment:
      | (ProviderEnvironment & {
          currentVersion: ProviderVersion | null;
        })
      | null;
  }
) => ({
  object: 'custom_provider.environment',

  id: customProviderEnvironment.id,

  customProviderId: customProviderEnvironment.customProvider.id,
  providerId: customProviderEnvironment.customProvider.provider?.id,
  currentProviderVersionId: customProviderEnvironment.providerEnvironment?.currentVersion?.id,

  instanceId: customProviderEnvironment.environment.identifier,

  createdAt: customProviderEnvironment.createdAt,
  updatedAt: customProviderEnvironment.updatedAt
});
