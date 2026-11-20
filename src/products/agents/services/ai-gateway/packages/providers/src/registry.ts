import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import {
  providerFeatures,
  providerFeatureSlugs,
  type ConnectionCheckResult,
  type ProviderConnectionConfig,
  type ProviderCredentials,
  type ProviderFeature,
  type ProviderFeatures
} from '@mtsrc/ai-gateway-spec';
import { anthropicProvider } from './definitions/anthropic';
import { azureProvider } from './definitions/azure';
import { cloudflareDecisionsProvider, typesafeProvider } from './definitions/decision';
import {
  cerebrasProvider,
  cohereProvider,
  deepinfraProvider,
  deepseekProvider,
  fireworksProvider,
  groqProvider,
  mistralProvider,
  openaiProvider,
  togetherProvider,
  xaiProvider
} from './definitions/openaiCompatible';
import { googleAiStudioProvider } from './definitions/google';
import type { ProviderDefinition, ProviderKind } from './lib/definition';
import { createLanguageModelFor, prepareCallOptions } from './lib/model';

let checkTimeoutMs = 10_000;

export let providerDefinitions: ProviderDefinition[] = [
  openaiProvider,
  anthropicProvider,
  googleAiStudioProvider,
  azureProvider,
  xaiProvider,
  mistralProvider,
  groqProvider,
  deepseekProvider,
  cerebrasProvider,
  togetherProvider,
  fireworksProvider,
  deepinfraProvider,
  cohereProvider,
  cloudflareDecisionsProvider,
  typesafeProvider
];

let bySlug = new Map(providerDefinitions.map(definition => [definition.slug, definition]));

export let providerKindOf = (definition: ProviderDefinition): ProviderKind =>
  definition.kind ?? 'inference';

export let decisionProviderDefinitions = providerDefinitions.filter(
  definition => providerKindOf(definition) == 'decision'
);

export let supportedProviderSlugs = providerDefinitions
  .filter(definition => providerKindOf(definition) == 'inference')
  .map(definition => definition.slug);

export let isSupportedProvider = (slug: string) => bySlug.has(slug);

export let isDecisionProvider = (slug: string) => {
  let definition = bySlug.get(slug);
  return !!definition && providerKindOf(definition) == 'decision';
};

export let getProviderDefinition = (slug: string) => {
  let definition = bySlug.get(slug);
  if (!definition) {
    throw new ServiceError(
      badRequestError({ message: `The provider "${slug}" is not supported by the gateway.` })
    );
  }

  return definition;
};

let validationMessage = (errors: { message: string; path?: string[] }[]) =>
  errors.map(error => (error.path?.length ? `${error.path.join('.')}: ` : '') + error.message);

export let parseProviderInput = (d: {
  providerSlug: string;
  credentials?: unknown;
  config?: unknown;
}) => {
  let definition = getProviderDefinition(d.providerSlug);

  let config = definition.config.validate(d.config ?? {});
  if (!config.success) {
    throw new ServiceError(
      badRequestError({
        message: `Invalid ${definition.name} connection config: ${validationMessage(config.errors).join(', ')}`
      })
    );
  }

  if (d.credentials === undefined) return { definition, config: config.value };

  let credentials = definition.credentials.validate(d.credentials);
  if (!credentials.success) {
    throw new ServiceError(
      badRequestError({
        message: `Invalid ${definition.name} credentials: ${validationMessage(credentials.errors).join(', ')}`
      })
    );
  }

  return { definition, config: config.value, credentials: credentials.value };
};

let featuresSchema = v.record(v.boolean());

export let parseProviderFeatures = (d: {
  providerSlug: string;
  features: unknown;
}): ProviderFeatures => {
  let definition = getProviderDefinition(d.providerSlug);

  let parsed = featuresSchema.validate(d.features ?? {});
  if (!parsed.success) {
    throw new ServiceError(
      badRequestError({
        message: `Invalid ${definition.name} features: ${validationMessage(parsed.errors).join(', ')}`
      })
    );
  }

  let keys = Object.keys(parsed.value);

  let unknown = keys.filter(
    feature => !providerFeatureSlugs.includes(feature as ProviderFeature)
  );
  if (unknown.length) {
    throw new ServiceError(
      badRequestError({ message: `Unknown provider features: ${unknown.join(', ')}.` })
    );
  }

  let unsupported = keys.filter(
    feature => !definition.features.includes(feature as ProviderFeature)
  );
  if (unsupported.length) {
    throw new ServiceError(
      badRequestError({
        message: `${definition.name} does not support ${unsupported
          .map(feature => providerFeatures[feature as ProviderFeature].name.toLowerCase())
          .join(' or ')}.`
      })
    );
  }

  return parsed.value as ProviderFeatures;
};

export let createProviderLanguageModel = (d: {
  providerSlug: string;
  credentials: ProviderCredentials;
  config: ProviderConnectionConfig;
  modelId: string;
  fetch?: typeof fetch;
}) =>
  createLanguageModelFor({
    definition: getProviderDefinition(d.providerSlug),
    credentials: d.credentials,
    config: d.config,
    modelId: d.modelId,
    fetch: d.fetch
  });

export let providerCountsTokens = (providerSlug: string) =>
  !!getProviderDefinition(providerSlug).countTokens;

export let countProviderTokens = async (d: {
  providerSlug: string;
  credentials: ProviderCredentials;
  config: ProviderConnectionConfig;
  modelId: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}) => {
  let definition = getProviderDefinition(d.providerSlug);
  if (!definition.countTokens) {
    throw new Error(`The provider "${d.providerSlug}" cannot count tokens.`);
  }

  return await definition.countTokens({
    credentials: d.credentials,
    config: d.config,
    modelId: d.modelId,
    body: d.body,
    signal: d.signal,
    fetch: d.fetch ?? fetch
  });
};

export let prepareProviderCallOptions = <
  Options extends Omit<LanguageModelV4CallOptions, 'abortSignal'>
>(d: {
  providerSlug: string;
  options: Options;
}) => prepareCallOptions(d.options, getProviderDefinition(d.providerSlug));

export let checkProviderConnection = async (d: {
  providerSlug: string;
  credentials: ProviderCredentials;
  config: ProviderConnectionConfig;
  fetch?: typeof fetch;
}): Promise<ConnectionCheckResult> => {
  let definition = getProviderDefinition(d.providerSlug);

  return await definition.check({
    credentials: d.credentials,
    config: d.config,
    signal: AbortSignal.timeout(checkTimeoutMs),
    fetch: d.fetch ?? fetch
  });
};
