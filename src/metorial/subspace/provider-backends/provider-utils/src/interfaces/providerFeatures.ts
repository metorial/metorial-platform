import { IProviderFunctionality } from '../providerFunctionality';

export type ProviderFeatureSpec = {
  customProviders: { enabled: boolean };
};

export abstract class IProviderFeatures extends IProviderFunctionality {
  abstract getFeatures(): ProviderFeatureSpec;
}
