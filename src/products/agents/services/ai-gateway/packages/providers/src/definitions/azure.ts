import { createAzure } from '@ai-sdk/azure';
import { v } from '@lowerdeck/validation';
import { defineProvider, lastFourHint } from '../lib/definition';
import { checkModelList } from '../lib/modelList';

// The resource name becomes part of a hostname we call, so it is restricted to what Azure allows
// for resource names instead of accepting a free-form URL.
let resourceNamePattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export let azureProvider = defineProvider({
  slug: 'azure',
  name: 'Microsoft Azure AI Foundry',
  credentials: v.object({ apiKey: v.string({ modifiers: [v.minLength(1)] }) }),
  config: v.object({
    resourceName: v.string({
      modifiers: [
        v.regex(resourceNamePattern, {
          message: 'The resource name may only contain lowercase letters, digits and hyphens.'
        })
      ]
    })
  }),
  features: ['zdr'],
  credentialHint: credentials => lastFourHint(credentials.apiKey),
  check: async ctx =>
    await checkModelList({
      url: `https://${ctx.config.resourceName}.openai.azure.com/openai/v1/models`,
      headers: { 'api-key': ctx.credentials.apiKey },
      signal: ctx.signal,
      fetch: ctx.fetch
    }),
  languageModel: ctx =>
    createAzure({
      resourceName: ctx.config.resourceName,
      apiKey: ctx.credentials.apiKey,
      fetch: ctx.fetch
    }).responses(ctx.modelId),
  providerOptionsKey: 'azure',
  inheritsProviderOptions: ['openai'],
  enforcedProviderOptions: { azure: { store: false } }
});
