import {
  claudeCodeTranscriptId,
  claudeCodeTranscriptRequestSchema
} from '@mtsrc/agent-tracking-spec';
import { claudeCodeRequestFact } from '../otlp/claudeCode';
import { usageDialect } from '../usageRequest';
import { buildUsage } from '../values';

export let claudeCodeTranscript = usageDialect({
  id: claudeCodeTranscriptId,
  adapter: 'claude-code',
  channel: 'transcript',
  schema: claudeCodeTranscriptRequestSchema,

  request: payload => ({
    sessionId: payload.session_id,
    identity: [payload.message_id],
    requestId: payload.request_id,
    factKey: claudeCodeRequestFact(payload.request_id),
    model: payload.model,
    usage: buildUsage({
      inputUncached: payload.input_tokens,
      cacheRead: payload.cache_read_input_tokens,
      cacheWrite: payload.cache_creation_input_tokens,
      cacheWrite5m: payload.cache_creation_5m_input_tokens,
      cacheWrite1h: payload.cache_creation_1h_input_tokens,
      output: payload.output_tokens
    }),
    purpose: 'main'
  })
});
