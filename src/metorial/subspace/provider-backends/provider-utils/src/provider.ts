import type {
  IProviderAuth,
  IProviderCapabilities,
  IProviderCallbackConfig,
  IProviderDeployment,
  IProviderEnclaveInstanceConfiguration,
  IProviderEnrichments,
  IProviderFeatures,
  IProviderInvocation,
  IProviderRun
} from './interfaces';
import type { ProviderFunctionalityCtorParams } from './providerFunctionality';

export interface ProviderImpl {
  auth: new (params: ProviderFunctionalityCtorParams) => IProviderAuth;
  providerRun: new (params: ProviderFunctionalityCtorParams) => IProviderRun;
  providerInvocation: new (params: ProviderFunctionalityCtorParams) => IProviderInvocation;
  features: new (params: ProviderFunctionalityCtorParams) => IProviderFeatures;
  deployment: new (params: ProviderFunctionalityCtorParams) => IProviderDeployment;
  enclaveInstanceConfiguration: new (
    params: ProviderFunctionalityCtorParams
  ) => IProviderEnclaveInstanceConfiguration;
  capabilities: new (params: ProviderFunctionalityCtorParams) => IProviderCapabilities;
  callbackConfig: new (params: ProviderFunctionalityCtorParams) => IProviderCallbackConfig;
  enrichment: new (params: ProviderFunctionalityCtorParams) => IProviderEnrichments;
}

export let createProvider = (impl: ProviderImpl) => ({
  create: (params: ProviderFunctionalityCtorParams) => ({
    auth: new impl.auth(params),
    features: new impl.features(params),
    deployment: new impl.deployment(params),
    enclaveInstanceConfiguration: new impl.enclaveInstanceConfiguration(params),
    providerRun: new impl.providerRun(params),
    providerInvocation: new impl.providerInvocation(params),
    capabilities: new impl.capabilities(params),
    callbackConfig: new impl.callbackConfig(params),
    enrichment: new impl.enrichment(params),

    backend: params.backend
  })
});
