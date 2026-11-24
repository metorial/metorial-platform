import { chunksOf, finishOf, usageOf, type Script } from '../script';
import type { WireEvent } from './sse';

let finishReasons = {
  stop: 'COMPLETE',
  'stop-sequence': 'STOP_SEQUENCE',
  length: 'MAX_TOKENS',
  'tool-calls': 'TOOL_CALL',
  'content-filter': 'ERROR_TOXIC'
} as const;

export let cohereEvents = (script: Script): WireEvent[] => {
  let events: WireEvent[] = [];
  let push = (data: Record<string, unknown>) =>
    events.push({ event: data.type as string, data });

  push({ type: 'message-start', id: script.id ?? 'cohere-fake' });

  let contentIndex = 0;
  for (let step of script.steps) {
    if (step.type == 'tool-call') {
      push({
        type: 'tool-call-start',
        delta: {
          message: {
            tool_calls: {
              id: step.id,
              type: 'function',
              function: { name: step.name, arguments: '' }
            }
          }
        }
      });
      for (let delta of chunksOf(JSON.stringify(step.input), script.chunkSize ?? 8)) {
        push({
          type: 'tool-call-delta',
          delta: { message: { tool_calls: { function: { arguments: delta } } } }
        });
      }
      push({ type: 'tool-call-end' });
      continue;
    }

    let index = contentIndex++;
    let kind = step.type == 'reasoning' ? 'thinking' : 'text';
    push({
      type: 'content-start',
      index,
      delta: { message: { content: { type: kind, [kind]: '' } } }
    });
    for (let delta of chunksOf(step.text, script.chunkSize)) {
      push({
        type: 'content-delta',
        index,
        delta: { message: { content: { [kind]: delta } } }
      });
    }
    push({ type: 'content-end', index });
  }

  let usage = usageOf(script);
  push({
    type: 'message-end',
    delta: {
      finish_reason: finishReasons[finishOf(script)],
      usage: {
        billed_units: { input_tokens: usage.input, output_tokens: usage.output },
        tokens: { input_tokens: usage.input, output_tokens: usage.output }
      }
    }
  });

  return events;
};
