import { chunksOf, finishOf, usageOf, type Script } from '../script';
import type { WireEvent } from './sse';

let stopReasons = {
  stop: 'end_turn',
  'stop-sequence': 'stop_sequence',
  length: 'max_tokens',
  'tool-calls': 'tool_use',
  'content-filter': 'refusal'
} as const;

export let anthropicEvents = (script: Script, model: string): WireEvent[] => {
  let usage = usageOf(script);
  let events: WireEvent[] = [];

  let push = (data: Record<string, unknown>) =>
    events.push({ event: data.type as string, data });

  push({
    type: 'message_start',
    message: {
      id: script.id ?? 'msg_fake',
      type: 'message',
      role: 'assistant',
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: usage.input,
        output_tokens: 1,
        cache_creation_input_tokens: usage.cacheWrite,
        cache_read_input_tokens: usage.cacheRead
      }
    }
  });

  script.steps.forEach((step, index) => {
    if (step.type == 'reasoning' && step.redacted) {
      push({
        type: 'content_block_start',
        index,
        content_block: { type: 'redacted_thinking', data: step.redacted }
      });
      push({ type: 'content_block_stop', index });
      return;
    }

    if (step.type == 'reasoning') {
      push({
        type: 'content_block_start',
        index,
        content_block: { type: 'thinking', thinking: '', signature: '' }
      });
      for (let delta of chunksOf(step.text, script.chunkSize)) {
        push({
          type: 'content_block_delta',
          index,
          delta: { type: 'thinking_delta', thinking: delta }
        });
      }
      push({
        type: 'content_block_delta',
        index,
        delta: { type: 'signature_delta', signature: step.signature ?? 'sig' }
      });
      push({ type: 'content_block_stop', index });
      return;
    }

    if (step.type == 'text') {
      push({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
      for (let delta of chunksOf(step.text, script.chunkSize)) {
        push({
          type: 'content_block_delta',
          index,
          delta: { type: 'text_delta', text: delta }
        });
      }
      push({ type: 'content_block_stop', index });
      return;
    }

    push({
      type: 'content_block_start',
      index,
      content_block: { type: 'tool_use', id: step.id, name: step.name, input: {} }
    });
    for (let delta of chunksOf(JSON.stringify(step.input), script.chunkSize ?? 8)) {
      push({
        type: 'content_block_delta',
        index,
        delta: { type: 'input_json_delta', partial_json: delta }
      });
    }
    push({ type: 'content_block_stop', index });
  });

  if (script.failMidStream) {
    push({
      type: 'error',
      error: { type: 'overloaded_error', message: script.failMidStream.message }
    });
    return events;
  }

  push({
    type: 'message_delta',
    delta: { stop_reason: stopReasons[finishOf(script)], stop_sequence: null },
    usage: { output_tokens: usage.output }
  });
  push({ type: 'message_stop' });

  return events;
};
