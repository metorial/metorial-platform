import { v } from '@lowerdeck/validation';
import { count, jsonNumber, model, nativeId, pattern, tokens } from './fields';

export let claudeCodeTranscriptId = 'claude-code.transcript.v1';

export let codexTranscriptId = 'codex.transcript.v1';

export let antigravityTranscriptId = 'antigravity.transcript.v1';

export let cursorHooksId = 'cursor.hooks.v1';

export let opencodePluginId = 'opencode.plugin.v1';

let maxSessionTokens = 1_000_000_000_000;
let maxStepIndex = 1_000_000_000;
export let maxCostUsd = 1_000_000;

let requestBase = {
  kind: v.literal('request'),
  session_id: nativeId,
  model,
  input_tokens: tokens,
  output_tokens: tokens
};

export let claudeCodeTranscriptRequestSchema = v.object({
  ...requestBase,
  message_id: nativeId,
  request_id: v.optional(nativeId),
  cache_read_input_tokens: v.optional(tokens),
  cache_creation_input_tokens: v.optional(tokens),
  cache_creation_5m_input_tokens: v.optional(tokens),
  cache_creation_1h_input_tokens: v.optional(tokens),
  purpose: v.optional(v.enumOf(['main', 'subagent']))
});

export let codexTranscriptRequestSchema = v.object({
  ...requestBase,
  cumulative_total_tokens: count(maxSessionTokens),
  cached_input_tokens: v.optional(tokens),
  cache_write_input_tokens: v.optional(tokens),
  reasoning_output_tokens: v.optional(tokens),
  total_tokens: v.optional(tokens)
});

export let antigravityTranscriptRequestSchema = v.object({
  ...requestBase,
  step_index: count(maxStepIndex),
  cache_read_tokens: v.optional(tokens)
});

export let cursorHooksRequestSchema = v.object({
  ...requestBase,
  generation_id: nativeId,
  cache_read_tokens: v.optional(tokens),
  cache_write_tokens: v.optional(tokens)
});

export let opencodePluginRequestSchema = v.object({
  ...requestBase,
  message_id: nativeId,
  provider: v.optional(pattern(/^[\x21-\x7e]{1,64}$/)),
  reasoning_tokens: v.optional(tokens),
  cache_read_tokens: v.optional(tokens),
  cache_write_tokens: v.optional(tokens),
  cost_usd: v.optional(
    v.number({
      preprocessors: [jsonNumber],
      modifiers: [v.minValue(0), v.maxValue(maxCostUsd)]
    })
  )
});
