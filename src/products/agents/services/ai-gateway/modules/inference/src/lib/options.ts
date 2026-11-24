import type { CallOptions } from '@mtsrc/ai-gateway-dialects';
import type { ParameterOverrides } from '@mtsrc/ai-gateway-spec';

// Virtual model overrides win over what the caller asked for: they exist to pin cost and
// behaviour of a route regardless of the client.
export let applyOverrides = (
  options: CallOptions,
  overrides: ParameterOverrides | null
): CallOptions => {
  if (!overrides) return options;

  return {
    ...options,
    reasoning: overrides.reasoningEffort ?? options.reasoning,
    maxOutputTokens: overrides.maxOutputTokens ?? options.maxOutputTokens,
    temperature: overrides.temperature ?? options.temperature
  };
};

let hasLongCacheTtl = (value: unknown): boolean => {
  if (!value || typeof value != 'object') return false;
  if (Array.isArray(value)) return value.some(hasLongCacheTtl);

  let record = value as Record<string, unknown>;
  let cacheControl = (record.anthropic as { cacheControl?: { ttl?: unknown } } | undefined)
    ?.cacheControl;
  if (cacheControl?.ttl == '1h') return true;

  return Object.values(record).some(hasLongCacheTtl);
};

// Anthropic prices cache writes by lifetime. One-hour breakpoints are the expensive ones, so a
// request that sets any prices all its cache writes at that rate rather than undercounting.
export let cacheWriteTtlOf = (options: CallOptions) =>
  hasLongCacheTtl([options.prompt, options.tools, options.providerOptions]) ? '1h' : '5m';

export let promptStats = (options: CallOptions) => ({
  messageCount: options.prompt.filter(message => message.role != 'system').length,
  toolCount: options.tools?.length ?? 0,
  maxOutputTokens: options.maxOutputTokens
});
