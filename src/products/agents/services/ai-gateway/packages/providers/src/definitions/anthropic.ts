import { v } from '@lowerdeck/validation';
import { defineProvider, lastFourHint } from '../lib/definition';
import { checkModelList } from '../lib/modelList';

let anthropicVersion = '2023-06-01';

export let anthropicProvider = defineProvider({
  slug: 'anthropic',
  name: 'Anthropic',
  credentials: v.object({ apiKey: v.string({ modifiers: [v.minLength(1)] }) }),
  config: v.object({}),
  features: ['zdr'],
  credentialHint: credentials => lastFourHint(credentials.apiKey),
  check: async ctx =>
    await checkModelList({
      url: 'https://api.anthropic.com/v1/models',
      headers: { 'x-api-key': ctx.credentials.apiKey, 'anthropic-version': anthropicVersion },
      signal: ctx.signal,
      fetch: ctx.fetch
    })
});
