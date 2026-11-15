import { detag } from '../../../lib/detag';
import type { CompactionCheckInfo } from '../../../lib/open-harness';
import { defaultEstimateTokens } from '../../../lib/open-harness/lib/utils';

export let explorerReservedTokens = 20_000;
export let explorerProtectedTokens = 40_000;
export let explorerMinPruneSavings = 8_000;

export let explorerContextWindow = (contextWindow: number) => Math.ceil(contextWindow * 0.9);

export let explorerCompactionPrompt = detag`
Summarize this conversation so the assistant can continue helping the user with their connected integrations.
Preserve:
1. Goal: what the user is trying to accomplish
2. Integrations and tools: which services and tools were used, and the arguments that matter
3. Findings: records, names, statuses, and identifiers retrieved from tools
4. Actions: changes already made in external systems
5. Constraints: preferences and limits the user stated
6. Open work: what is still unfinished
Omit raw tool payloads, tokens, and connection secrets.
`;

export let explorerShouldCompact = (info: CompactionCheckInfo) => {
  let used = Math.max(info.lastInputTokens, defaultEstimateTokens(info.messages));
  return used >= info.contextWindow - info.reservedTokens;
};
