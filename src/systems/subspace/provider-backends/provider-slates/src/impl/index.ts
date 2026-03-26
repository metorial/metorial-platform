import { createProvider } from '@metorial-subspace/provider-utils';
import { ProviderAuth } from './auth';
import { ProviderCapabilities } from './capabilities';
import { ProviderDeployment } from './deployment';
import { ProviderEnrichments } from './enrichment';
import { ProviderFeatures } from './features';
import { ProviderRun } from './run';

export let slatesProvider = createProvider({
  auth: ProviderAuth,
  providerRun: ProviderRun,
  features: ProviderFeatures,
  deployment: ProviderDeployment,
  enrichment: ProviderEnrichments,
  capabilities: ProviderCapabilities
});
