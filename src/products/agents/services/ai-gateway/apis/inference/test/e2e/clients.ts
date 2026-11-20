import type Anthropic from '@anthropic-ai/sdk';
import type { Dialect } from '@mtsrc/ai-gateway-dialects';
import type OpenAI from 'openai';
import type { Gateway } from './harness';

export type Finish = 'stop' | 'length' | 'tool_calls' | 'other';

export type ToolCall = { id: string; name: string; args: unknown };

// What a client got out of one model turn, independent of the API it used.
export type Turn = {
  text: string;
  reasoning: string;
  toolCalls: ToolCall[];
  finish: Finish;
  usage: { input: number; output: number };
};

export type Ask = {
  system?: string;
  prompt: string;
  tools?: { name: string; description: string; parameters: Record<string, unknown> }[];
  maxTokens?: number;
};

export let model = 'lab/test-model';

let chatFinish = (reason: string | null | undefined): Finish =>
  reason == 'stop'
    ? 'stop'
    : reason == 'length'
      ? 'length'
      : reason == 'tool_calls'
        ? 'tool_calls'
        : 'other';

let anthropicFinish = (reason: string | null | undefined): Finish =>
  reason == 'end_turn' || reason == 'stop_sequence'
    ? 'stop'
    : reason == 'max_tokens'
      ? 'length'
      : reason == 'tool_use'
        ? 'tool_calls'
        : 'other';

export let chatRequest = (ask: Ask) => ({
  model,
  messages: [
    ...(ask.system ? [{ role: 'system' as const, content: ask.system }] : []),
    { role: 'user' as const, content: ask.prompt }
  ],
  ...(ask.tools
    ? {
        tools: ask.tools.map(tool => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }))
      }
    : {}),
  ...(ask.maxTokens ? { max_completion_tokens: ask.maxTokens } : {})
});

export let responsesRequest = (ask: Ask) => ({
  model,
  ...(ask.system ? { instructions: ask.system } : {}),
  input: ask.prompt,
  ...(ask.tools
    ? {
        tools: ask.tools.map(tool => ({
          type: 'function' as const,
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          strict: false
        }))
      }
    : {}),
  ...(ask.maxTokens ? { max_output_tokens: ask.maxTokens } : {})
});

export let messagesRequest = (ask: Ask) => ({
  model,
  max_tokens: ask.maxTokens ?? 1024,
  ...(ask.system ? { system: ask.system } : {}),
  messages: [{ role: 'user' as const, content: ask.prompt }],
  ...(ask.tools
    ? {
        tools: ask.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: { type: 'object' as const, ...tool.parameters }
        }))
      }
    : {})
});

export let chatTurn = (completion: OpenAI.Chat.Completions.ChatCompletion): Turn => {
  let choice = completion.choices[0]!;
  let message = choice.message as typeof choice.message & { reasoning_content?: string };

  return {
    text: message.content ?? '',
    reasoning: message.reasoning_content ?? '',
    toolCalls: (message.tool_calls ?? []).flatMap(call =>
      call.type == 'function'
        ? [
            {
              id: call.id,
              name: call.function.name,
              args: JSON.parse(call.function.arguments)
            }
          ]
        : []
    ),
    finish: chatFinish(choice.finish_reason),
    usage: {
      input: completion.usage?.prompt_tokens ?? 0,
      output: completion.usage?.completion_tokens ?? 0
    }
  };
};

// The SDK's stream helper assigns unknown delta fields instead of appending them, so streamed
// chunks are accumulated by hand the way a careful client would.
export let chatStreamTurn = async (
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
): Promise<Turn & { chunks: OpenAI.Chat.Completions.ChatCompletionChunk[] }> => {
  let chunks: OpenAI.Chat.Completions.ChatCompletionChunk[] = [];
  let text = '';
  let reasoning = '';
  let calls: { id: string; name: string; args: string }[] = [];
  let finish: string | null = null;
  let usage = { input: 0, output: 0 };

  for await (let chunk of stream) {
    chunks.push(chunk);
    if (chunk.usage)
      usage = { input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens };

    let choice = chunk.choices[0];
    if (!choice) continue;

    let delta = choice.delta as typeof choice.delta & { reasoning_content?: string };
    text += delta.content ?? '';
    reasoning += delta.reasoning_content ?? '';
    for (let call of delta.tool_calls ?? []) {
      let entry = (calls[call.index] ??= { id: '', name: '', args: '' });
      if (call.id) entry.id = call.id;
      if (call.function?.name) entry.name = call.function.name;
      entry.args += call.function?.arguments ?? '';
    }
    if (choice.finish_reason) finish = choice.finish_reason;
  }

  return {
    chunks,
    text,
    reasoning,
    toolCalls: calls.map(call => ({
      id: call.id,
      name: call.name,
      args: JSON.parse(call.args)
    })),
    finish: chatFinish(finish),
    usage
  };
};

export let responsesTurn = (response: OpenAI.Responses.Response): Turn => {
  let text = '';
  let reasoning = '';
  let toolCalls: ToolCall[] = [];

  for (let item of response.output) {
    if (item.type == 'message') {
      for (let part of item.content) if (part.type == 'output_text') text += part.text;
    }
    if (item.type == 'reasoning') {
      reasoning += item.summary.map(part => part.text).join('');
      reasoning += (item.content ?? []).map(part => part.text).join('');
    }
    if (item.type == 'function_call') {
      toolCalls.push({ id: item.call_id, name: item.name, args: JSON.parse(item.arguments) });
    }
  }

  return {
    text,
    reasoning,
    toolCalls,
    finish:
      response.status == 'incomplete'
        ? response.incomplete_details?.reason == 'max_output_tokens'
          ? 'length'
          : 'other'
        : toolCalls.length
          ? 'tool_calls'
          : 'stop',
    usage: {
      input: response.usage?.input_tokens ?? 0,
      output: response.usage?.output_tokens ?? 0
    }
  };
};

export let messagesTurn = (message: Anthropic.Message): Turn => ({
  text: message.content.flatMap(block => (block.type == 'text' ? [block.text] : [])).join(''),
  reasoning: message.content
    .flatMap(block => (block.type == 'thinking' ? [block.thinking] : []))
    .join(''),
  toolCalls: message.content.flatMap(block =>
    block.type == 'tool_use' ? [{ id: block.id, name: block.name, args: block.input }] : []
  ),
  finish: anthropicFinish(message.stop_reason),
  usage: {
    input:
      message.usage.input_tokens +
      (message.usage.cache_read_input_tokens ?? 0) +
      (message.usage.cache_creation_input_tokens ?? 0),
    output: message.usage.output_tokens
  }
});

export let ask = async (
  gateway: Gateway,
  dialect: Dialect,
  request: Ask,
  d: { stream: boolean }
) => {
  if (dialect == 'openai_chat') {
    if (!d.stream)
      return chatTurn(await gateway.openai.chat.completions.create(chatRequest(request)));

    return await chatStreamTurn(
      await gateway.openai.chat.completions.create({
        ...chatRequest(request),
        stream: true,
        stream_options: { include_usage: true }
      })
    );
  }

  if (dialect == 'open_responses') {
    if (!d.stream)
      return responsesTurn(await gateway.openai.responses.create(responsesRequest(request)));

    return responsesTurn(
      await gateway.openai.responses.stream(responsesRequest(request)).finalResponse()
    );
  }

  if (!d.stream)
    return messagesTurn(await gateway.anthropic.messages.create(messagesRequest(request)));

  return messagesTurn(
    await gateway.anthropic.messages.stream(messagesRequest(request)).finalMessage()
  );
};
