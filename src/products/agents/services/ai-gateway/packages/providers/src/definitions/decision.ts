import { v } from '@lowerdeck/validation';
import { decisionProviderSlugs } from '@mtsrc/ai-gateway-spec';
import { defineProvider, lastFourHint } from '../lib/definition';
import { checkModelList } from '../lib/modelList';

export let typesafeProvider = defineProvider({
  slug: decisionProviderSlugs.typesafe,
  name: 'TypeSafe',
  kind: 'decision',
  website: 'https://typesafe.ai',
  docs: 'https://docs.typesafe.ai',
  credentials: v.object({ apiKey: v.string({ modifiers: [v.minLength(1)] }) }),
  config: v.object({}),
  features: ['zdr'],
  credentialHint: credentials => lastFourHint(credentials.apiKey),
  check: async ctx =>
    await checkModelList({
      url: 'https://api.typesafe.ai/v1/models',
      headers: { authorization: `Bearer ${ctx.credentials.apiKey}` },
      signal: ctx.signal,
      fetch: ctx.fetch
    })
});

// Searching the Workers AI catalog needs the same `Workers AI` permission as running Clef, so a
// successful search proves the token can classify without spending neurons.
export let cloudflareDecisionsProvider = defineProvider({
  slug: decisionProviderSlugs.cloudflare,
  name: 'Cloudflare Workers AI',
  kind: 'decision',
  website: 'https://developers.cloudflare.com/workers-ai',
  docs: 'https://blog.cloudflare.com/clef-decision-models',
  credentials: v.object({ apiToken: v.string({ modifiers: [v.minLength(1)] }) }),
  config: v.object({ accountId: v.string({ modifiers: [v.minLength(1)] }) }),
  features: ['zdr'],
  credentialHint: credentials => lastFourHint(credentials.apiToken),
  check: async ctx =>
    await checkModelList({
      url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(ctx.config.accountId)}/ai/models/search?search=clef&per_page=5`,
      headers: { authorization: `Bearer ${ctx.credentials.apiToken}` },
      signal: ctx.signal,
      fetch: ctx.fetch
    })
});
