import {
  IProviderEnclaveInstanceConfiguration,
  type ProviderEnclaveInstanceConfigurationSyncParam
} from '@metorial-subspace/provider-utils';

export class ProviderEnclaveInstanceConfiguration extends IProviderEnclaveInstanceConfiguration {
  override async syncEnclaveInstanceConfiguration(
    _data: ProviderEnclaveInstanceConfigurationSyncParam
  ): Promise<void> {}
}
