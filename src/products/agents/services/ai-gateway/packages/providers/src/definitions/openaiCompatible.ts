import { createCerebras } from '@ai-sdk/cerebras';
import { createCohere } from '@ai-sdk/cohere';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createFireworks } from '@ai-sdk/fireworks';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV4, SharedV4ProviderOptions } from '@ai-sdk/provider';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createXai } from '@ai-sdk/xai';
import { v } from '@lowerdeck/validation';
import type { ProviderFeature } from '@mtsrc/ai-gateway-spec';
import { defineProvider, lastFourHint } from '../lib/definition';
import { checkModelList } from '../lib/modelList';

let apiKeyCredentials = v.object({ apiKey: v.string({ modifiers: [v.minLength(1)] }) });

let noConfig = v.object({});

type ModelFactory = (d: {
  apiKey: string;
  fetch: typeof fetch;
}) => (modelId: string) => LanguageModelV4;

// OpenAI-compatible providers: the model list is a plain `GET` with `Authorization: Bearer <key>`.
let openaiCompatibleProvider = (d: {
  slug: string;
  name: string;
  modelsUrl: string;
  features?: ProviderFeature[];
  model: ModelFactory;
  providerOptionsKey: string;
  enforcedProviderOptions?: SharedV4ProviderOptions;
}) =>
  defineProvider({
    slug: d.slug,
    name: d.name,
    credentials: apiKeyCredentials,
    config: noConfig,
    features: d.features ?? [],
    credentialHint: credentials => lastFourHint(credentials.apiKey),
    check: async ctx =>
      await checkModelList({
        url: d.modelsUrl,
        headers: { authorization: `Bearer ${ctx.credentials.apiKey}` },
        signal: ctx.signal,
        fetch: ctx.fetch
      }),
    languageModel: ctx =>
      d.model({ apiKey: ctx.credentials.apiKey, fetch: ctx.fetch })(ctx.modelId),
    providerOptionsKey: d.providerOptionsKey,
    enforcedProviderOptions: d.enforcedProviderOptions
  });

export let openaiProvider = openaiCompatibleProvider({
  slug: 'openai',
  name: 'OpenAI',
  modelsUrl: 'https://api.openai.com/v1/models',
  features: ['zdr'],
  model: d => modelId => createOpenAI(d).responses(modelId),
  providerOptionsKey: 'openai',
  enforcedProviderOptions: { openai: { store: false } }
});

export let xaiProvider = openaiCompatibleProvider({
  slug: 'xai',
  name: 'xAI',
  modelsUrl: 'https://api.x.ai/v1/models',
  features: ['zdr'],
  model: d => createXai(d),
  providerOptionsKey: 'xai',
  enforcedProviderOptions: { xai: { store: false } }
});

export let mistralProvider = openaiCompatibleProvider({
  slug: 'mistral',
  name: 'Mistral AI',
  modelsUrl: 'https://api.mistral.ai/v1/models',
  features: ['zdr'],
  model: d => createMistral(d),
  providerOptionsKey: 'mistral'
});

export let groqProvider = openaiCompatibleProvider({
  slug: 'groq',
  name: 'Groq',
  modelsUrl: 'https://api.groq.com/openai/v1/models',
  features: ['zdr'],
  model: d => createGroq(d),
  providerOptionsKey: 'groq'
});

export let deepseekProvider = openaiCompatibleProvider({
  slug: 'deepseek',
  name: 'DeepSeek',
  modelsUrl: 'https://api.deepseek.com/models',
  model: d => createDeepSeek(d),
  providerOptionsKey: 'deepseek'
});

export let cerebrasProvider = openaiCompatibleProvider({
  slug: 'cerebras',
  name: 'Cerebras',
  modelsUrl: 'https://api.cerebras.ai/v1/models',
  features: ['zdr'],
  model: d => createCerebras(d),
  providerOptionsKey: 'cerebras'
});

export let togetherProvider = openaiCompatibleProvider({
  slug: 'together',
  name: 'Together AI',
  modelsUrl: 'https://api.together.xyz/v1/models',
  features: ['zdr'],
  model: d => createTogetherAI(d),
  providerOptionsKey: 'togetherai'
});

export let fireworksProvider = openaiCompatibleProvider({
  slug: 'fireworks',
  name: 'Fireworks AI',
  modelsUrl: 'https://api.fireworks.ai/inference/v1/models',
  features: ['zdr'],
  model: d => createFireworks(d),
  providerOptionsKey: 'fireworks'
});

export let deepinfraProvider = openaiCompatibleProvider({
  slug: 'deepinfra',
  name: 'DeepInfra',
  modelsUrl: 'https://api.deepinfra.com/v1/openai/models',
  features: ['zdr'],
  model: d => createDeepInfra(d),
  providerOptionsKey: 'deepinfra'
});

export let cohereProvider = openaiCompatibleProvider({
  slug: 'cohere',
  name: 'Cohere',
  modelsUrl: 'https://api.cohere.com/v1/models',
  features: ['zdr'],
  model: d => createCohere(d),
  providerOptionsKey: 'cohere'
});
