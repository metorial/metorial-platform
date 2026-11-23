import { chunksOf, finishOf, usageOf, type Script } from '../script';
import type { WireEvent } from './sse';

let createdAt = 1_760_000_000;

export let openaiResponsesEvents = (script: Script, model: string): WireEvent[] => {
  let id = script.id ?? 'resp_fake';
  let sequence = 0;
  let events: WireEvent[] = [];

  let push = (data: Record<string, unknown>) =>
    events.push({
      event: data.type as string,
      data: { ...data, sequence_number: sequence++ }
    });

  let response = (status: string, extra: Record<string, unknown> = {}) => ({
    id,
    object: 'response',
    created_at: createdAt,
    model,
    status,
    output: [],
    usage: null,
    ...extra
  });

  push({ type: 'response.created', response: response('in_progress') });
  push({ type: 'response.in_progress', response: response('in_progress') });

  script.steps.forEach((step, outputIndex) => {
    if (step.type == 'reasoning') {
      let itemId = `rs_${outputIndex}`;
      push({
        type: 'response.output_item.added',
        output_index: outputIndex,
        item: {
          type: 'reasoning',
          id: itemId,
          status: 'in_progress',
          summary: [],
          encrypted_content: null
        }
      });
      push({
        type: 'response.reasoning_summary_part.added',
        item_id: itemId,
        output_index: outputIndex,
        summary_index: 0,
        part: { type: 'summary_text', text: '' }
      });
      for (let delta of chunksOf(step.text, script.chunkSize)) {
        push({
          type: 'response.reasoning_summary_text.delta',
          item_id: itemId,
          output_index: outputIndex,
          summary_index: 0,
          delta
        });
      }
      push({
        type: 'response.reasoning_summary_part.done',
        item_id: itemId,
        output_index: outputIndex,
        summary_index: 0,
        part: { type: 'summary_text', text: step.text }
      });
      push({
        type: 'response.output_item.done',
        output_index: outputIndex,
        item: {
          type: 'reasoning',
          id: itemId,
          status: 'completed',
          summary: [{ type: 'summary_text', text: step.text }],
          encrypted_content: step.signature ?? null
        }
      });
      return;
    }

    if (step.type == 'text') {
      let itemId = `msg_${outputIndex}`;
      push({
        type: 'response.output_item.added',
        output_index: outputIndex,
        item: {
          type: 'message',
          id: itemId,
          role: 'assistant',
          status: 'in_progress',
          content: []
        }
      });
      push({
        type: 'response.content_part.added',
        item_id: itemId,
        output_index: outputIndex,
        content_index: 0,
        part: { type: 'output_text', text: '', annotations: [] }
      });
      for (let delta of chunksOf(step.text, script.chunkSize)) {
        push({
          type: 'response.output_text.delta',
          item_id: itemId,
          output_index: outputIndex,
          content_index: 0,
          delta,
          logprobs: []
        });
      }
      push({
        type: 'response.output_text.done',
        item_id: itemId,
        output_index: outputIndex,
        content_index: 0,
        text: step.text
      });
      push({
        type: 'response.content_part.done',
        item_id: itemId,
        output_index: outputIndex,
        content_index: 0,
        part: { type: 'output_text', text: step.text, annotations: [] }
      });
      push({
        type: 'response.output_item.done',
        output_index: outputIndex,
        item: {
          type: 'message',
          id: itemId,
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: step.text, annotations: [] }]
        }
      });
      return;
    }

    let itemId = `fc_${outputIndex}`;
    let args = JSON.stringify(step.input);
    push({
      type: 'response.output_item.added',
      output_index: outputIndex,
      item: {
        type: 'function_call',
        id: itemId,
        call_id: step.id,
        name: step.name,
        arguments: '',
        status: 'in_progress'
      }
    });
    for (let delta of chunksOf(args, script.chunkSize ?? 8)) {
      push({
        type: 'response.function_call_arguments.delta',
        item_id: itemId,
        output_index: outputIndex,
        delta
      });
    }
    push({
      type: 'response.function_call_arguments.done',
      item_id: itemId,
      output_index: outputIndex,
      arguments: args
    });
    push({
      type: 'response.output_item.done',
      output_index: outputIndex,
      item: {
        type: 'function_call',
        id: itemId,
        call_id: step.id,
        name: step.name,
        arguments: args,
        status: 'completed'
      }
    });
  });

  if (script.failMidStream) {
    push({
      type: 'error',
      code: 'server_error',
      message: script.failMidStream.message,
      param: null
    });
    return events;
  }

  let usage = usageOf(script);
  let finish = finishOf(script);
  let incompleteReason =
    finish == 'length'
      ? 'max_output_tokens'
      : finish == 'content-filter'
        ? 'content_filter'
        : null;

  push({
    type: incompleteReason ? 'response.incomplete' : 'response.completed',
    response: response(incompleteReason ? 'incomplete' : 'completed', {
      incomplete_details: incompleteReason ? { reason: incompleteReason } : null,
      usage: {
        input_tokens: usage.input + usage.cacheRead + usage.cacheWrite,
        input_tokens_details: { cached_tokens: usage.cacheRead },
        output_tokens: usage.output,
        output_tokens_details: { reasoning_tokens: usage.reasoning },
        total_tokens: usage.input + usage.cacheRead + usage.cacheWrite + usage.output
      }
    })
  });

  return events;
};
