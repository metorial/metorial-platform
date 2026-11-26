import {
  antigravityTranscriptId,
  antigravityTranscriptRequestSchema
} from '@mtsrc/agent-tracking-spec';
import { usageDialect } from '../usageRequest';
import { buildUsage, normalizeEffort } from '../values';

let effortSuffix = /-(low|medium|high)$/;

export let antigravityTranscript = usageDialect({
  id: antigravityTranscriptId,
  adapter: 'antigravity',
  channel: 'transcript',
  schema: antigravityTranscriptRequestSchema,

  request: payload => {
    let counted =
      payload.input_tokens + payload.output_tokens + (payload.cache_read_tokens ?? 0);
    if (counted == 0) return null;

    return {
      sessionId: payload.session_id,
      identity: [payload.step_index],
      model: payload.model,
      usage: buildUsage({
        inputUncached: payload.input_tokens,
        cacheRead: payload.cache_read_tokens,
        output: payload.output_tokens
      }),
      effort: normalizeEffort(effortSuffix.exec(payload.model)?.[1]),
      purpose: 'main'
    };
  }
});
