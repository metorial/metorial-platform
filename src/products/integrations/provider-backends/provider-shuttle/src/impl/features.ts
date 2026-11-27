import {
  IProviderFeatures,
  type ProviderFeatureSpec
} from '@metorial-subspace/provider-utils';

export class ProviderFeatures extends IProviderFeatures {
  override getFeatures(): ProviderFeatureSpec {
    return {
      customProviders: { enabled: true }
    };
  }
}
