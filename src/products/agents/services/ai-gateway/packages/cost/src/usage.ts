import type { GatewayUsage } from '@mtsrc/ai-gateway-spec';

export type ReportedUsage = {
  inputTokens: {
    total: number | undefined;
    noCache: number | undefined;
    cacheRead: number | undefined;
    cacheWrite: number | undefined;
  };
  outputTokens: {
    total: number | undefined;
    text: number | undefined;
    reasoning: number | undefined;
  };
};

let count = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

// Providers report partial usage: some send only totals, some only the split. Missing parts are
// derived from the others so that total == noCache + cacheRead + cacheWrite (and text +
// reasoning for output) always holds.
export let normalizeUsage = (usage: ReportedUsage): GatewayUsage => {
  let cacheRead = count(usage.inputTokens.cacheRead);
  let cacheWrite = count(usage.inputTokens.cacheWrite);
  let noCache =
    usage.inputTokens.noCache !== undefined
      ? count(usage.inputTokens.noCache)
      : Math.max(0, count(usage.inputTokens.total) - cacheRead - cacheWrite);

  let reasoning = count(usage.outputTokens.reasoning);
  let text =
    usage.outputTokens.text !== undefined
      ? count(usage.outputTokens.text)
      : Math.max(0, count(usage.outputTokens.total) - reasoning);

  return {
    input: { total: noCache + cacheRead + cacheWrite, noCache, cacheRead, cacheWrite },
    output: { total: text + reasoning, text, reasoning }
  };
};
