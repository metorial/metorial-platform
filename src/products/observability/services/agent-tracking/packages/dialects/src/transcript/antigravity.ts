import {
  antigravityTranscriptId,
  antigravityTranscriptRequestSchema
} from '@mtsrc/agent-tracking-spec';
import { usageDialect } from '../usageRequest';
import { buildUsage } from '../values';

// The CLI appends the thinking level to the model id; the level does not change the price.
let levelSuffix = /^(.+)-(low|medium|high|xhigh)$/;

let efforts: Record<string, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'max'
};

export let antigravityTranscript = usageDialect({
  id: antigravityTranscriptId,
  adapter: 'antigravity',
  channel: 'transcript',
  schema: antigravityTranscriptRequestSchema,

  request: payload => {
    let [, model = payload.model, level] = levelSuffix.exec(payload.model) ?? [];

    return {
      sessionId: payload.session_id,
      identity: [payload.step_index],
      model,
      usage: buildUsage({
        inputUncached: payload.input_tokens,
        cacheRead: payload.cache_read_tokens,
        output: payload.output_tokens
      }),
      effort: level ? efforts[level] : undefined,
      purpose: 'main'
    };
  }
});
