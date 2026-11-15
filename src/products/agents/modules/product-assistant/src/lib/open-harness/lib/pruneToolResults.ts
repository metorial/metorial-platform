import type { ModelMessage, ToolResultPart } from 'ai';
import { defaultEstimateTokens } from './utils';

export type PruneToolResults = {
  messages: ModelMessage[];
  tokensSaved: number;
  messagesModified: number;
};

let estimateMessageTokens = (
  message: ModelMessage,
  estimateTokens: (messages: ModelMessage[]) => number
) => estimateTokens([message]);

let isToolResultPart = (part: unknown): part is ToolResultPart =>
  !!part && typeof part == 'object' && (part as { type?: unknown }).type == 'tool-result';

let pruneCopiedToolResults = (
  messages: ModelMessage[],
  protectedTokens: number,
  estimateTokens: (messages: ModelMessage[]) => number
) => {
  let result = structuredClone(messages);
  let accumulated = 0;
  let boundary = 0;

  for (let i = result.length - 1; i >= 0; i--) {
    accumulated += estimateMessageTokens(result[i]!, estimateTokens);
    if (accumulated >= protectedTokens) {
      boundary = i;
      break;
    }
  }

  let tokensSaved = 0;
  let messagesModified = 0;

  for (let i = 0; i < boundary; i++) {
    let message = result[i]!;
    if (message.role != 'tool' || !Array.isArray(message.content)) continue;

    let before = estimateMessageTokens(message, estimateTokens);
    let modified = false;
    message.content = message.content.map(part => {
      if (!isToolResultPart(part)) return part;
      modified = true;
      return {
        ...part,
        output: { type: 'text' as const, value: '[pruned]' }
      };
    });
    if (!modified) continue;

    let after = estimateMessageTokens(message, estimateTokens);
    tokensSaved += before - after;
    messagesModified++;
  }

  return { messages: result, tokensSaved, messagesModified };
};

let copyPrunedToolOutputs = (original: ModelMessage[], pruned: ModelMessage[]) => {
  for (let i = 0; i < original.length; i++) {
    let source = original[i];
    let next = pruned[i];
    if (!source || !next || source.role != 'tool' || next.role != 'tool') continue;
    if (!Array.isArray(source.content) || !Array.isArray(next.content)) continue;
    source.content = next.content;
  }
};

export let pruneOldToolResults = (
  messages: ModelMessage[],
  options: {
    protectedTokens: number;
    minSavings: number;
    estimateTokens?: (messages: ModelMessage[]) => number;
    inPlace?: boolean;
  }
): PruneToolResults => {
  let estimateTokens = options.estimateTokens ?? defaultEstimateTokens;
  let pruned = pruneCopiedToolResults(messages, options.protectedTokens, estimateTokens);

  if (pruned.tokensSaved < options.minSavings) {
    return { messages, tokensSaved: 0, messagesModified: 0 };
  }

  if (options.inPlace) {
    copyPrunedToolOutputs(messages, pruned.messages);
    return {
      messages,
      tokensSaved: pruned.tokensSaved,
      messagesModified: pruned.messagesModified
    };
  }

  return pruned;
};
