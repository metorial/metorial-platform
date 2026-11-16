import type { ModelMessage } from 'ai';

// Compaction starts once a request fills this share of the model's context window, and shrinks
// the history until the estimate is back under the target share.
export let COMPACTION_TRIGGER_RATIO = 0.6;
export let COMPACTION_TARGET_RATIO = 0.4;

// Tool results from the most recent N tool messages that stay intact at each level, tried in
// order until the history is small enough.
let KEEP_RECENT_LEVELS = [6, 2, 0];

// Results that are already short (section writes, score previews, errors) are not worth stubbing.
let MIN_STUB_CHARS = 400;

let OMITTED = '[Output omitted to save context. Run the command again if you need it.]';

let estimateTokens = (messages: ModelMessage[]) => JSON.stringify(messages).length / 3.5;

let outputSize = (output: unknown) =>
  typeof output == 'string' ? output.length : JSON.stringify(output ?? '').length;

let compactToolResults = (messages: ModelMessage[], keepRecent: number): ModelMessage[] => {
  let toolMessageIndexes = messages.flatMap((message, index) =>
    message.role == 'tool' ? [index] : []
  );
  let protectedIndexes = new Set(keepRecent ? toolMessageIndexes.slice(-keepRecent) : []);

  return messages.map((message, index) => {
    if (message.role == 'tool') {
      if (protectedIndexes.has(index)) return message;

      return {
        ...message,
        content: message.content.map(part =>
          part.type == 'tool-result' &&
          (part.output.type == 'text' ||
            part.output.type == 'json' ||
            part.output.type == 'content') &&
          outputSize(part.output.value) > MIN_STUB_CHARS
            ? { ...part, output: { type: 'text' as const, value: OMITTED } }
            : part
        )
      };
    }

    // Reasoning is never needed again once the step that produced it has finished.
    if (message.role == 'assistant' && Array.isArray(message.content)) {
      let content = message.content.filter(part => part.type != 'reasoning');
      return content.length == message.content.length ? message : { ...message, content };
    }

    return message;
  });
};

export type CompactionResult = {
  messages: ModelMessage[];
  compacted: boolean;
};

export let compactMessages = (d: {
  messages: ModelMessage[];
  lastInputTokens: number;
  contextWindow: number | undefined;
}): CompactionResult => {
  if (!d.contextWindow || d.lastInputTokens < d.contextWindow * COMPACTION_TRIGGER_RATIO) {
    return { messages: d.messages, compacted: false };
  }

  // The provider's real token count is the most reliable signal, so the character-based
  // estimate is only used for the ratio between the history before and after compaction.
  let before = estimateTokens(d.messages);
  let tokensPerEstimate = d.lastInputTokens / Math.max(before, 1);
  let target = d.contextWindow * COMPACTION_TARGET_RATIO;

  let messages = d.messages;
  for (let keepRecent of KEEP_RECENT_LEVELS) {
    messages = compactToolResults(d.messages, keepRecent);
    if (estimateTokens(messages) * tokensPerEstimate <= target) break;
  }

  return { messages, compacted: JSON.stringify(messages) != JSON.stringify(d.messages) };
};
