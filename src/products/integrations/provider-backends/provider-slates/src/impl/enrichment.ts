import {
  IProviderEnrichments,
  type ProviderVariantEnrichmentInput,
  type ProviderVariantEnrichmentOutput,
  type ProviderVersionEnrichmentInput,
  type ProviderVersionEnrichmentOutput
} from '@metorial-subspace/provider-utils';

export class ProviderEnrichments extends IProviderEnrichments {
  override enrichProviderVariants(
    input: ProviderVariantEnrichmentInput
  ): ProviderVariantEnrichmentOutput {
    return {
      providers: input.providerVariantIds.map(providerVariantId => ({
        providerVariantId
      }))
    };
  }

  override enrichProviderVersions(
    input: ProviderVersionEnrichmentInput
  ): ProviderVersionEnrichmentOutput {
    return {
      providers: input.providerVersionIds.map(providerVersionId => ({
        providerVersionId
      }))
    };
  }
}
