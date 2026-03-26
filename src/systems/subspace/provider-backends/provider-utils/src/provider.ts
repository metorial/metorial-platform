import type {
  IProviderAuth,
  IProviderCapabilities,
  IProviderDeployment,
  IProviderEnrichments,
  IProviderFeatures,
  IProviderRun
} from './interfaces';
import type { ProviderFunctionalityCtorParams } from './providerFunctionality';

export interface ProviderImpl {
  auth: new (params: ProviderFunctionalityCtorParams) => IProviderAuth;
  providerRun: new (params: ProviderFunctionalityCtorParams) => IProviderRun;
  features: new (params: ProviderFunctionalityCtorParams) => IProviderFeatures;
  deployment: new (params: ProviderFunctionalityCtorParams) => IProviderDeployment;
  capabilities: new (params: ProviderFunctionalityCtorParams) => IProviderCapabilities;
  enrichment: new (params: ProviderFunctionalityCtorParams) => IProviderEnrichments;
}

export let createProvider = (impl: ProviderImpl) => ({
  create: (params: ProviderFunctionalityCtorParams) => ({
    auth: new impl.auth(params),
    features: new impl.features(params),
    deployment: new impl.deployment(params),
    providerRun: new impl.providerRun(params),
    capabilities: new impl.capabilities(params),
    enrichment: new impl.enrichment(params),

    backend: params.backend
  })
});
