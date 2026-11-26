import { codexTranscriptId, codexTranscriptRequestSchema } from '@mtsrc/agent-tracking-spec';
import { usageDialect } from '../usageRequest';
import { buildUsage } from '../values';

// The running total names the response; after a compaction Codex repeats it with no tokens. No id
// is shared with Codex OTel, so no fact key.
export let codexTranscript = usageDialect({
  id: codexTranscriptId,
  adapter: 'codex',
  channel: 'transcript',
  schema: codexTranscriptRequestSchema,

  request: payload => {
    let counted =
      payload.input_tokens +
      payload.output_tokens +
      (payload.cached_input_tokens ?? 0) +
      (payload.reasoning_output_tokens ?? 0);

    if (counted == 0) return null;

    return {
      sessionId: payload.session_id,
      identity: [payload.cumulative_total_tokens],
      model: payload.model,
      usage: buildUsage({
        inputIncludingCache: payload.input_tokens,
        cacheRead: payload.cached_input_tokens,
        cacheWrite: payload.cache_write_input_tokens,
        outputIncludingReasoning: payload.output_tokens,
        reasoning: payload.reasoning_output_tokens,
        totalReported: payload.total_tokens
      })
    };
  }
});
