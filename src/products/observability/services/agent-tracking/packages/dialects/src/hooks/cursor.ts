import { cursorHooksId, cursorHooksRequestSchema } from '@mtsrc/agent-tracking-spec';
import { usageDialect } from '../usageRequest';
import { buildUsage } from '../values';

// The stop hook reports the whole turn; its input count includes cache reads and writes.
export let cursorHooks = usageDialect({
  id: cursorHooksId,
  adapter: 'cursor',
  channel: 'hook',
  schema: cursorHooksRequestSchema,

  request: payload => ({
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
  })
});
