import { v } from '@lowerdeck/validation';
import type { ProviderFeature } from '@mtsrc/ai-gateway-spec';
import { defineProvider, lastFourHint } from '../lib/definition';
import { checkModelList } from '../lib/modelList';

let apiKeyCredentials = v.object({ apiKey: v.string({ modifiers: [v.minLength(1)] }) });

let noConfig = v.object({});

// OpenAI-compatible providers: the model list is a plain `GET` with `Authorization: Bearer <key>`.
let openaiCompatibleProvider = (d: {
  slug: string;
  name: string;
  modelsUrl: string;
  features?: ProviderFeature[];
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
      })
  });

export let openaiProvider = openaiCompatibleProvider({
  slug: 'openai',
  name: 'OpenAI',
  modelsUrl: 'https://api.openai.com/v1/models',
  features: ['zdr']
});

export let xaiProvider = openaiCompatibleProvider({
  slug: 'xai',
  name: 'xAI',
  modelsUrl: 'https://api.x.ai/v1/models',
  features: ['zdr']
});

export let mistralProvider = openaiCompatibleProvider({
  slug: 'mistral',
  name: 'Mistral AI',
  modelsUrl: 'https://api.mistral.ai/v1/models',
  features: ['zdr']
});

export let groqProvider = openaiCompatibleProvider({
  slug: 'groq',
  name: 'Groq',
  modelsUrl: 'https://api.groq.com/openai/v1/models',
  features: ['zdr']
});

export let deepseekProvider = openaiCompatibleProvider({
  slug: 'deepseek',
  name: 'DeepSeek',
  modelsUrl: 'https://api.deepseek.com/models'
});

export let cerebrasProvider = openaiCompatibleProvider({
  slug: 'cerebras',
  name: 'Cerebras',
  modelsUrl: 'https://api.cerebras.ai/v1/models',
  features: ['zdr']
});

export let togetherProvider = openaiCompatibleProvider({
  slug: 'together',
  name: 'Together AI',
  modelsUrl: 'https://api.together.xyz/v1/models',
  features: ['zdr']
});

export let fireworksProvider = openaiCompatibleProvider({
  slug: 'fireworks',
  name: 'Fireworks AI',
  modelsUrl: 'https://api.fireworks.ai/inference/v1/models',
  features: ['zdr']
});

export let deepinfraProvider = openaiCompatibleProvider({
  slug: 'deepinfra',
  name: 'DeepInfra',
  modelsUrl: 'https://api.deepinfra.com/v1/openai/models',
  features: ['zdr']
});

export let cohereProvider = openaiCompatibleProvider({
  slug: 'cohere',
  name: 'Cohere',
  modelsUrl: 'https://api.cohere.com/v1/models',
  features: ['zdr']
});
