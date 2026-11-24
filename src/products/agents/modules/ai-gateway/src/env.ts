import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';

export let aiGatewaySettings = defineSettings('aiGateway', {
  apiUrl: setting(v.optional(v.string({ modifiers: [v.url()] })), {
    env: 'AI_GATEWAY_API_URL',
    audience: 'deployment',
    description:
      'Internal URL of the AI gateway RPC API, including its /metorial-ai-gateway path. Scope sync, plan limits and AI gateway billing are off while unset.'
  })
});
