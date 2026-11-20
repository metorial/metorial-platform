import { addTokens, emptyTokens, type Tokens } from '@mtsrc/agent-tracking-cost';
import { count, isRecord, sumTokens, timestampOf, widenSpan, type TimeSpan } from './tokens';

let syntheticModel = '<synthetic>';

type ClaudeCostStateModel = { model: string; tokens: Tokens; costUsd: number };

export type ClaudeCostState = {
  totalCostUsd: number;
  hasUnknownModelCost: boolean;
  entries: number;
  models: ClaudeCostStateModel[];
};

type ClaudeMessageModel = { model: string; messages: number; tokens: Tokens };

export type ClaudeMessageUsage = {
  files: number;
  lines: number;
  messages: number;
  models: ClaudeMessageModel[];
  tokens: Tokens;
  perLine: Tokens;
  withIterations: Tokens;
  span: TimeSpan;
};

let usageTokens = (usage: Record<string, any>): Tokens => ({
  inputUncached: count(usage.input_tokens),
  output: count(usage.output_tokens),
  cacheRead: count(usage.cache_read_input_tokens),
  cacheWrite: count(usage.cache_creation_input_tokens),
  reasoning: count(usage.output_tokens_details?.thinking_tokens)
});

let iterationTokens = (usage: Record<string, any>) =>
  sumTokens(
    (Array.isArray(usage.iterations) ? usage.iterations : [])
      .filter(isRecord)
      .map((iteration: Record<string, any>) => usageTokens(iteration))
  );

export let parseJsonLines = (text: string) => {
  let entries: unknown[] = [];
  let invalidLines = 0;

  for (let line of text.split('\n')) {
    if (!line.trim()) continue;

    try {
      entries.push(JSON.parse(line));
    } catch {
      invalidLines++;
    }
  }

  return { entries, invalidLines };
};

// The client merges this entry as "last wins", so the last one is the session's state.
export let readCostState = (entries: Iterable<unknown>): ClaudeCostState | null => {
  let last: Record<string, any> | null = null;
  let seen = 0;

  for (let entry of entries) {
    if (!isRecord(entry) || entry.type != 'cost-state') continue;

    last = entry;
    seen++;
  }

  if (!last) return null;

  let modelUsage = isRecord(last.modelUsage) ? last.modelUsage : {};

  return {
    totalCostUsd: count(last.totalCostUSD),
    hasUnknownModelCost: last.hasUnknownModelCost === true,
    entries: seen,
    models: Object.entries(modelUsage)
      .filter(([, usage]) => isRecord(usage))
      .map(([model, usage]: [string, Record<string, any>]) => ({
        model,
        tokens: {
          inputUncached: count(usage.inputTokens),
          output: count(usage.outputTokens),
          cacheRead: count(usage.cacheReadInputTokens),
          cacheWrite: count(usage.cacheCreationInputTokens),
          reasoning: count(usage.thinkingTokens)
        },
        costUsd: count(usage.costUSD)
      }))
      .sort((a, b) => a.model.localeCompare(b.model))
  };
};

// A transcript writes one line per content block and repeats the message's usage on each, and
// a usage block can repeat its counts in `iterations`. Counting each message once, from its
// last line, is the reading; `perLine` and `withIterations` are the two wrong readings, kept
// so a figure that equals one of them can be named.
export let readMessageUsage = (files: Iterable<Iterable<unknown>>): ClaudeMessageUsage => {
  let byMessage = new Map<string, { model: string; tokens: Tokens }>();
  let perLine = emptyTokens();
  let withIterations = emptyTokens();
  let span: TimeSpan = { firstAt: null, lastAt: null };
  let fileCount = 0;
  let lines = 0;

  for (let entries of files) {
    fileCount++;

    for (let entry of entries) {
      lines++;
      if (!isRecord(entry)) continue;

      widenSpan(span, timestampOf(entry.timestamp));

      let message = entry.message;
      if (entry.type != 'assistant' || !isRecord(message) || !isRecord(message.usage))
        continue;

      let model = typeof message.model == 'string' ? message.model : 'unknown';
      if (model == syntheticModel) continue;

      let tokens = usageTokens(message.usage);
      addTokens(perLine, tokens);
      addTokens(withIterations, tokens);
      addTokens(withIterations, iterationTokens(message.usage));

      let key =
        typeof message.id == 'string'
          ? `message:${message.id}`
          : typeof entry.requestId == 'string'
            ? `request:${entry.requestId}`
            : `line:${fileCount}:${lines}`;

      byMessage.set(key, { model, tokens });
    }
  }

  let models = new Map<string, ClaudeMessageModel>();
  for (let { model, tokens } of byMessage.values()) {
    let entry = models.get(model) ?? { model, messages: 0, tokens: emptyTokens() };
    entry.messages++;
    addTokens(entry.tokens, tokens);
    models.set(model, entry);
  }

  let sorted = [...models.values()].sort((a, b) => a.model.localeCompare(b.model));

  return {
    files: fileCount,
    lines,
    messages: byMessage.size,
    models: sorted,
    tokens: sumTokens(sorted.map(model => model.tokens)),
    perLine,
    withIterations,
    span
  };
};
