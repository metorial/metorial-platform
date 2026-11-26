import { opencodePluginId, opencodePluginRequestSchema } from '@mtsrc/agent-tracking-spec';
import { usageDialect } from '../usageRequest';
import { buildUsage, normalizeProvider, usdCost } from '../values';

// OpenCode stores input without the cache reads and writes, and output without reasoning, for
// every provider. It also reports a cost of 0 whenever it has no price (free and subscription
// models, gateways without a configured price), so 0 means no cost and the catalog prices it.
export let opencodePlugin = usageDialect({
  id: opencodePluginId,
  adapter: 'opencode',
  channel: 'sse',
  schema: opencodePluginRequestSchema,

  request: payload => {
    let counted =
      payload.input_tokens +
      payload.output_tokens +
      (payload.reasoning_tokens ?? 0) +
      (payload.cache_read_tokens ?? 0) +
      (payload.cache_write_tokens ?? 0);
    let cost = payload.cost_usd
      ? usdCost({ usd: payload.cost_usd }, 'client_estimate')
      : undefined;
    if (counted == 0 && !cost) return null;

    return {
      sessionId: payload.session_id,
      identity: [payload.message_id],
      model: payload.model,
      provider: normalizeProvider(payload.provider),
      usage: buildUsage({
        inputUncached: payload.input_tokens,
        cacheRead: payload.cache_read_tokens,
        cacheWrite: payload.cache_write_tokens,
        output: payload.output_tokens,
        reasoning: payload.reasoning_tokens
      }),
      cost,
      purpose: 'main'
    };
  }
});
