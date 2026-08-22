import { createProvider } from '@metorial-subspace/provider-utils';
import { ProviderAuth } from './auth';
import { ProviderCapabilities } from './capabilities';
import { ProviderCallbackConfig } from './callbackConfig';
import { ProviderDeployment } from './deployment';
import { ProviderEnclaveInstanceConfiguration } from './enclaveInstanceConfiguration';
import { ProviderEnrichments } from './enrichment';
import { ProviderFeatures } from './features';
import { ProviderInvocation } from './providerInvocation';
import { ProviderRun } from './run';

export let shuttleProvider = createProvider({
  auth: ProviderAuth,
  providerRun: ProviderRun,
  providerInvocation: ProviderInvocation,
  features: ProviderFeatures,
  deployment: ProviderDeployment,
  enclaveInstanceConfiguration: ProviderEnclaveInstanceConfiguration,
  enrichment: ProviderEnrichments,
  capabilities: ProviderCapabilities,
  callbackConfig: ProviderCallbackConfig
});
