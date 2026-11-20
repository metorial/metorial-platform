import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';
import { redisUrl, serviceUrl } from '@metorial/shared-settings';

let serviceSettings = defineSettings({
  service: {
    REDIS_URL: redisUrl
  },

  nebula: {
    NEBULA_API_URL: serviceUrl('nebula'),
    NEBULA_CONSUMER_TOKEN: setting(v.string(), {
      audience: 'deployment',
      secret: true,
      description: 'Consumer token the gateway uses to store provider API keys in Nebula.'
    })
  }
});

let credentialsSettings = defineSettings('credentials', {
  checkIntervalHours: setting(v.number({ modifiers: [v.integer(), v.minValue(1)] }), {
    env: 'AI_GATEWAY_CONNECTION_CHECK_HOURS',
    audience: 'deployment',
    default: 6,
    description: 'How often a valid provider connection is re-checked against the provider.'
  })
});

let platformKey = (envName: string, provider: string) =>
  setting(v.optional(v.string()), {
    env: envName,
    audience: 'deployment',
    secret: true,
    description: `${provider} key behind the metorial provider. Its platform connection stays disabled while unset.`
  });

let platformSettings = defineSettings('platform', {
  openaiApiKey: platformKey('AI_GATEWAY_PLATFORM_OPENAI_API_KEY', 'OpenAI'),
  anthropicApiKey: platformKey('AI_GATEWAY_PLATFORM_ANTHROPIC_API_KEY', 'Anthropic'),
  googleApiKey: platformKey('AI_GATEWAY_PLATFORM_GOOGLE_API_KEY', 'Google AI Studio'),
  xaiApiKey: platformKey('AI_GATEWAY_PLATFORM_XAI_API_KEY', 'xAI'),
  mistralApiKey: platformKey('AI_GATEWAY_PLATFORM_MISTRAL_API_KEY', 'Mistral AI'),
  deepseekApiKey: platformKey('AI_GATEWAY_PLATFORM_DEEPSEEK_API_KEY', 'DeepSeek'),
  azureApiKey: platformKey('AI_GATEWAY_PLATFORM_AZURE_API_KEY', 'Azure AI Foundry'),
  azureResourceName: setting(v.optional(v.string()), {
    env: 'AI_GATEWAY_PLATFORM_AZURE_RESOURCE_NAME',
    audience: 'deployment',
    description: 'Azure AI Foundry resource that AI_GATEWAY_PLATFORM_AZURE_API_KEY belongs to.'
  })
});

export let env = {
  ...serviceSettings,
  credentials: credentialsSettings,
  platform: platformSettings
};
