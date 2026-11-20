import type { Tokens } from '@mtsrc/agent-tracking-cost';
import { count, isRecord, timestampOf, widenSpan, type TimeSpan } from './tokens';

type CodexTokens = {
  input: number;
  cachedInput: number;
  cacheWriteInput: number;
  output: number;
  reasoningOutput: number;
  total: number;
};

export type CodexRollout = {
  threadId: string | null;
  sessionId: string | null;
  parentThreadId: string | null;
  models: string[];
  tokenCountEvents: number;
  total: CodexTokens | null;
  span: TimeSpan;
};

let codexTokens = (usage: Record<string, any>): CodexTokens => ({
  input: count(usage.input_tokens),
  cachedInput: count(usage.cached_input_tokens),
  cacheWriteInput: count(usage.cache_write_input_tokens),
  output: count(usage.output_tokens),
  reasoningOutput: count(usage.reasoning_output_tokens),
  total: count(usage.total_tokens)
});

// `total_token_usage` is the thread's running total, so the last token_count event is the
// thread's figure. A file can hold more than one session_meta (a fork); the first one is the
// thread the file belongs to.
export let readCodexRollout = (entries: Iterable<unknown>): CodexRollout => {
  let threadId: string | null = null;
  let sessionId: string | null = null;
  let parentThreadId: string | null = null;
  let models = new Set<string>();
  let tokenCountEvents = 0;
  let total: CodexTokens | null = null;
  let span: TimeSpan = { firstAt: null, lastAt: null };

  for (let entry of entries) {
    if (!isRecord(entry)) continue;

    widenSpan(span, timestampOf(entry.timestamp));

    let payload = isRecord(entry.payload) ? entry.payload : {};

    if (entry.type == 'session_meta' && threadId === null) {
      threadId = typeof payload.id == 'string' ? payload.id : null;
      sessionId = typeof payload.session_id == 'string' ? payload.session_id : null;
      parentThreadId =
        typeof payload.parent_thread_id == 'string' ? payload.parent_thread_id : null;
    }

    if (entry.type == 'turn_context' && typeof payload.model == 'string')
      models.add(payload.model);

    if (payload.type == 'token_count') {
      tokenCountEvents++;

      let usage = isRecord(payload.info) ? payload.info.total_token_usage : undefined;
      if (isRecord(usage)) total = codexTokens(usage);
    }
  }

  return {
    threadId,
    sessionId,
    parentThreadId,
    models: [...models].sort(),
    tokenCountEvents,
    total,
    span
  };
};

// Codex counts cached input inside input_tokens and reasoning inside output_tokens; the
// service stores them apart.
export let codexAsServiceTokens = (tokens: CodexTokens): Tokens => ({
  inputUncached: Math.max(0, tokens.input - tokens.cachedInput),
  output: Math.max(0, tokens.output - tokens.reasoningOutput),
  cacheRead: tokens.cachedInput,
  cacheWrite: tokens.cacheWriteInput,
  reasoning: tokens.reasoningOutput
});
