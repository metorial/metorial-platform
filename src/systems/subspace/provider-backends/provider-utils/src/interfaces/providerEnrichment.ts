import type {
  ShuttleContainerRegistry,
  ShuttleContainerRepository,
  ShuttleContainerTag,
  ShuttleContainerVersion
} from '@metorial-subspace/provider-shuttle';
import { IProviderFunctionality } from '../providerFunctionality';

export type ProviderVariantEnrichmentInput = {
  providerVariantIds: string[];
};

export type ProviderVariantEnrichmentOutput = {
  providers: {
    providerVariantId: string;

    containerTag?: ShuttleContainerTag;
    containerRegistry?: ShuttleContainerRegistry;
    containerRepository?: ShuttleContainerRepository;

    remoteUrl?: string;
    remoteProtocol?: 'sse' | 'streamable_http';
  }[];
};

export type ProviderVersionEnrichmentInput = {
  providerVersionIds: string[];
};

export type ProviderVersionEnrichmentOutput = {
  providers: {
    providerVersionId: string;

    containerTag?: ShuttleContainerTag;
    containerVersion?: ShuttleContainerVersion;
    containerRegistry?: ShuttleContainerRegistry;
    containerRepository?: ShuttleContainerRepository;

    remoteUrl?: string;
    remoteProtocol?: 'sse' | 'streamable_http';
  }[];
};

export abstract class IProviderEnrichments extends IProviderFunctionality {
  abstract enrichProviderVariants(
    input: ProviderVariantEnrichmentInput
  ): ProviderVariantEnrichmentOutput | Promise<ProviderVariantEnrichmentOutput>;

  abstract enrichProviderVersions(
    input: ProviderVersionEnrichmentInput
  ): ProviderVersionEnrichmentOutput | Promise<ProviderVersionEnrichmentOutput>;
}
