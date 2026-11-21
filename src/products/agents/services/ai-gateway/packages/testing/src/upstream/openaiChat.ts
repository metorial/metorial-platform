import { chunksOf, finishOf, usageOf, type Script } from '../script';
import type { WireEvent } from './sse';

let finishReasons = {
  stop: 'stop',
  'stop-sequence': 'stop',
  length: 'length',
  'tool-calls': 'tool_calls',
  'content-filter': 'content_filter'
} as const;

export let openaiChatEvents = (
  script: Script,
  model: string,
  d: {
    reasoningField?: 'reasoning_content' | 'reasoning' | 'thinking_content';
    usageStyle?: 'trailing' | 'inline' | 'x_groq';
  } = {}
): WireEvent[] => {
  let id = script.id ?? 'chatcmpl-fake';
  let reasoningField = d.reasoningField ?? 'reasoning_content';

  let chunk = (delta: Record<string, unknown>, finishReason: string | null = null) => ({
    data: {
      id,
      object: 'chat.completion.chunk',
      created: 1_760_000_000,
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason, logprobs: null }]
    }
  });

  let events: WireEvent[] = [chunk({ role: 'assistant', content: '' })];
  let toolIndex = 0;

  for (let step of script.steps) {
    // Mistral streams reasoning as typed content parts instead of a separate delta field.
    if (step.type == 'reasoning') {
      for (let delta of chunksOf(step.text, script.chunkSize)) {
        events.push(
          chunk(
            reasoningField == 'thinking_content'
              ? { content: [{ type: 'thinking', thinking: [{ type: 'text', text: delta }] }] }
              : { [reasoningField]: delta }
          )
        );
      }
      continue;
    }

    if (step.type == 'text') {
      for (let delta of chunksOf(step.text, script.chunkSize)) {
        events.push(chunk({ content: delta }));
      }
      continue;
    }

    let index = toolIndex++;
    events.push(
      chunk({
        tool_calls: [
          {
            index,
            id: step.id,
            type: 'function',
            function: { name: step.name, arguments: '' }
          }
        ]
      })
    );
    for (let delta of chunksOf(JSON.stringify(step.input), script.chunkSize ?? 8)) {
      events.push(chunk({ tool_calls: [{ index, function: { arguments: delta } }] }));
    }
  }

  if (script.failMidStream) {
    events.push({
      data: {
        error: { message: script.failMidStream.message, type: 'server_error', code: null }
      }
    });
    return events;
  }

  let tokens = usageOf(script);
  let usage = {
    prompt_tokens: tokens.input + tokens.cacheRead,
    completion_tokens: tokens.output,
    total_tokens: tokens.input + tokens.cacheRead + tokens.output,
    prompt_tokens_details: { cached_tokens: tokens.cacheRead },
    completion_tokens_details: { reasoning_tokens: tokens.reasoning }
  };

  let finishing = chunk({}, finishReasons[finishOf(script)]);

  // Vendors disagree on where usage goes: OpenAI sends a trailing chunk without choices, Mistral
  // puts it on the finishing chunk, Groq nests it under `x_groq`.
  if (d.usageStyle == 'inline') {
    events.push({ data: { ...finishing.data, usage } });
  } else if (d.usageStyle == 'x_groq') {
    events.push({ data: { ...finishing.data, x_groq: { id: 'req_fake', usage } } });
  } else {
    events.push(finishing);
    events.push({
      data: {
        id,
        object: 'chat.completion.chunk',
        created: 1_760_000_000,
        model,
        choices: [],
        usage
      }
    });
  }

  events.push({ data: '[DONE]' });

  return events;
};
