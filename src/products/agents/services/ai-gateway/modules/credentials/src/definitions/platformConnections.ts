import { env } from '../env';
import { platformConnection } from '../lib/definitions/platformConnection';

export let platformConnections = {
  openai: platformConnection({
    slug: 'openai',
    provider: 'openai',
    name: 'OpenAI',
    credentials: { apiKey: env.platform.openaiApiKey }
  }),

  anthropic: platformConnection({
    slug: 'anthropic',
    provider: 'anthropic',
    name: 'Anthropic',
    credentials: { apiKey: env.platform.anthropicApiKey }
  }),

  google: platformConnection({
    slug: 'google-ai-studio',
    provider: 'google-ai-studio',
    name: 'Google AI Studio',
    credentials: { apiKey: env.platform.googleApiKey }
  }),

  xai: platformConnection({
    slug: 'xai',
    provider: 'xai',
    name: 'xAI',
    credentials: { apiKey: env.platform.xaiApiKey }
  }),

  mistral: platformConnection({
    slug: 'mistral',
    provider: 'mistral',
    name: 'Mistral AI',
    credentials: { apiKey: env.platform.mistralApiKey }
  }),

  deepseek: platformConnection({
    slug: 'deepseek',
    provider: 'deepseek',
    name: 'DeepSeek',
    credentials: { apiKey: env.platform.deepseekApiKey }
  }),

  azure: platformConnection({
    slug: 'azure',
    provider: 'azure',
    name: 'Azure AI Foundry',
    credentials: { apiKey: env.platform.azureApiKey },
    config: { resourceName: env.platform.azureResourceName }
  })
};

export let allPlatformConnections = Object.values(platformConnections);
