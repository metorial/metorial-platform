import {
  allPlatformConnections,
  platformConnections
} from '@mtsrc/ai-gateway-module-credentials';
import { routingRule, validateRoutingRules } from '../lib/definitions/routingRule';

export let routingRules = {
  openaiDirect: routingRule({
    slug: 'openai-direct',
    lab: 'openai',
    via: platformConnections.openai,
    priority: 10
  }),

  openaiViaAzure: routingRule({
    slug: 'openai-via-azure',
    lab: 'openai',
    via: platformConnections.azure
  }),

  anthropicDirect: routingRule({
    slug: 'anthropic-direct',
    lab: 'anthropic',
    via: platformConnections.anthropic
  }),

  googleDirect: routingRule({
    slug: 'google-direct',
    lab: 'google',
    via: platformConnections.google
  }),

  xaiDirect: routingRule({
    slug: 'xai-direct',
    lab: 'xai',
    via: platformConnections.xai
  }),

  mistralDirect: routingRule({
    slug: 'mistral-direct',
    lab: 'mistral',
    via: platformConnections.mistral
  }),

  deepseekDirect: routingRule({
    slug: 'deepseek-direct',
    lab: 'deepseek',
    via: platformConnections.deepseek
  })
};

export let allRoutingRules = Object.values(routingRules);

validateRoutingRules({ rules: allRoutingRules, connections: allPlatformConnections });
