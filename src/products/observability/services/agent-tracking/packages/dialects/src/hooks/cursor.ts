import { cursorHooksId, cursorHooksRequestSchema } from '@mtsrc/agent-tracking-spec';
import { usageDialect } from '../usageRequest';
import { buildUsage } from '../values';

// The stop hook reports the whole turn; its input count includes cache reads and writes (Cursor
// itself subtracts both, floored at 0).
export let cursorHooks = usageDialect({
  id: cursorHooksId,
  adapter: 'cursor',
  channel: 'hook',
  schema: cursorHooksRequestSchema,

  request: payload => {
    let cached = (payload.cache_read_tokens ?? 0) + (payload.cache_write_tokens ?? 0);
    if (payload.input_tokens + payload.output_tokens + cached == 0) return null;

    return {
      type: 'turn.completed',
      sessionId: payload.session_id,
      identity: [payload.generation_id],
      model: payload.model,
      usage: buildUsage({
        inputIncludingCacheReadsAndWrites: payload.input_tokens,
        cacheRead: payload.cache_read_tokens,
        cacheWrite: payload.cache_write_tokens,
        output: payload.output_tokens,
        provenance: 'aggregate'
      })
    };
  }
});
