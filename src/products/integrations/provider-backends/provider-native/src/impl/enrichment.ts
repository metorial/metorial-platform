import {
  IProviderEnrichments,
  type ProviderVariantEnrichmentInput,
  type ProviderVariantEnrichmentOutput,
  type ProviderVersionEnrichmentInput,
  type ProviderVersionEnrichmentOutput
} from '@metorial-subspace/provider-utils';

export class ProviderEnrichments extends IProviderEnrichments {
  override async enrichProviderVariants(
    input: ProviderVariantEnrichmentInput
  ): Promise<ProviderVariantEnrichmentOutput> {
    return {
      providers: input.providerVariantIds.map(providerVariantId => ({
        providerVariantId
      }))
    };
  }

  override async enrichProviderVersions(
    input: ProviderVersionEnrichmentInput
  ): Promise<ProviderVersionEnrichmentOutput> {
    return {
      providers: input.providerVersionIds.map(providerVersionId => ({
        providerVersionId
      }))
    };
  }
}
