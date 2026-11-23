import type { RouteCandidate } from '@mtsrc/ai-gateway-module-routing';

// Which provider and key serve the metorial provider is never shown to tenants.
export let previewCandidate = (candidate: RouteCandidate) =>
  candidate.connectionOwner == 'platform'
    ? {
        provider: candidate.billedProviderSlug,
        connectionOwner: candidate.connectionOwner,
        pricing: candidate.billedPricing
      }
    : {
        provider: candidate.providerSlug,
        connectionOwner: candidate.connectionOwner,
        connectionId: candidate.connectionId,
        vendorModelId: candidate.vendorModelId,
        pricing: candidate.billedPricing,
        pricingSource: candidate.billedPricingSource
      };
