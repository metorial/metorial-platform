import { textOf, usageOf, type Script } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { anthropicClient, gatewayFetch, openaiClient } from './harness';

type Finish = 'stop' | 'length' | 'tool-calls' | 'content-filter';

type Summary = {
  text: string;
  reasoning: string[];
  toolCalls: { id: string; name: string; input: unknown }[];
  finish: Finish;
  usage: { input: number; output: number; cacheRead: number; reasoning: number };
};

let tools = [
  {
    name: 'get_weather',
    description: 'Weather for a city',
    parameters: { type: 'object', properties: { city: { type: 'string' } } }
  },
  {
    name: 'get_time',
    description: 'Time for a zone',
    parameters: { type: 'object', properties: { zone: { type: 'string' } } }
  }
];

let scenarios: { name: string; script: Script }[] = [
  {
    name: 'plain text',
    script: { steps: [{ type: 'text', text: 'Hello there, how can I help?' }] }
  },
  {
    name: 'unicode text streamed one character at a time',
    script: { chunkSize: 1, steps: [{ type: 'text', text: 'Grüße 👋🏽 — 你好, «ça va?»' }] }
  },
  { name: 'empty response', script: { steps: [], usage: { input: 3, output: 0 } } },
  {
    name: 'several text blocks',
    script: {
      steps: [
        { type: 'text', text: 'First block. ' },
        { type: 'text', text: 'Second block.' }
      ]
    }
  },
  {
    name: 'reasoning then text',
    script: {
      steps: [
        {
          type: 'reasoning',
          text: 'The user greets me, so I greet back.',
          signature: 'sig-1'
        },
        { type: 'text', text: 'Hi!' }
      ],
      usage: { input: 20, output: 30, reasoning: 18 }
    }
  },
  {
    name: 'reasoning without signature',
    script: {
      steps: [
        { type: 'reasoning', text: 'Raw open-weights reasoning.' },
        { type: 'text', text: 'Answer.' }
      ]
    }
  },
  {
    name: 'a single tool call',
    script: {
      steps: [
        { type: 'tool-call', id: 'call_1', name: 'get_weather', input: { city: 'Vienna' } }
      ]
    }
  },
  {
    name: 'parallel tool calls',
    script: {
      steps: [
        { type: 'tool-call', id: 'call_1', name: 'get_weather', input: { city: 'Vienna' } },
        { type: 'tool-call', id: 'call_2', name: 'get_time', input: { zone: 'Europe/Vienna' } }
      ]
    }
  },
  {
    name: 'text then a tool call',
    script: {
      steps: [
        { type: 'text', text: 'Let me check the weather.' },
        { type: 'tool-call', id: 'call_1', name: 'get_weather', input: { city: 'Paris' } }
      ]
    }
  },
  {
    name: 'reasoning then a tool call',
    script: {
      steps: [
        { type: 'reasoning', text: 'I need the weather tool.', signature: 'sig-2' },
        { type: 'tool-call', id: 'call_1', name: 'get_weather', input: { city: 'Oslo' } }
      ]
    }
  },
  {
    name: 'a tool call without streamed input',
    script: {
      steps: [
        {
          type: 'tool-call',
          id: 'call_9',
          name: 'get_time',
          input: { zone: 'UTC' },
          streamInput: false
        }
      ]
    }
  },
  {
    name: 'a tool call without arguments',
    script: { steps: [{ type: 'tool-call', id: 'call_0', name: 'get_time', input: {} }] }
  },
  {
    name: 'tool input with nested JSON and unicode',
    script: {
      chunkSize: 3,
      steps: [
        {
          type: 'tool-call',
          id: 'call_n',
          name: 'get_weather',
          input: { city: 'Zürich', options: { units: ['°C', '°F'], days: 3, detailed: true } }
        }
      ]
    }
  },
  {
    name: 'a stop that produced tool calls (Gemini style)',
    script: {
      finish: 'stop',
      steps: [
        { type: 'tool-call', id: 'call_g', name: 'get_weather', input: { city: 'Rome' } }
      ]
    }
  },
  {
    name: 'max tokens reached',
    script: { finish: 'length', steps: [{ type: 'text', text: 'This answer is cut' }] }
  },
  {
    name: 'content filtered',
    script: { finish: 'content-filter', steps: [{ type: 'text', text: '' }] }
  },
  {
    name: 'stop sequence',
    script: { finish: 'stop-sequence', steps: [{ type: 'text', text: 'Counting: 1, 2' }] }
  },
  {
    name: 'cached input and reasoning tokens',
    script: {
      steps: [{ type: 'text', text: 'Cached.' }],
      usage: { input: 10, output: 40, cacheRead: 1000, cacheWrite: 200, reasoning: 25 }
    }
  }
];

let expectedSummary = (script: Script): Summary => {
  let usage = usageOf(script);
  let toolCalls = script.steps.flatMap(step =>
    step.type == 'tool-call' ? [{ id: step.id, name: step.name, input: step.input }] : []
  );
  let finish = script.finish ?? (toolCalls.length ? 'tool-calls' : 'stop');

  return {
    text: textOf(script),
    reasoning: script.steps.flatMap(step =>
      step.type == 'reasoning' && step.text ? [step.text] : []
    ),
    toolCalls,
    finish:
      finish == 'stop-sequence'
        ? 'stop'
        : finish == 'stop' && toolCalls.length
          ? 'tool-calls'
          : finish,
    usage: {
      input: usage.input + usage.cacheRead + usage.cacheWrite,
      output: usage.output,
      cacheRead: usage.cacheRead,
      reasoning: usage.reasoning
    }
  };
};

let chatFinish: Record<string, Finish> = {
  stop: 'stop',
  length: 'length',
  tool_calls: 'tool-calls',
  content_filter: 'content-filter'
};

let chatSummary = (completion: any, reasoning?: string[]): Summary => {
  let message = completion.choices[0].message;

  return {
    text: message.content ?? '',
    reasoning: reasoning ?? (message.reasoning_content ? [message.reasoning_content] : []),
    toolCalls: (message.tool_calls ?? []).map((call: any) => ({
      id: call.id,
      name: call.function.name,
      input: JSON.parse(call.function.arguments)
    })),
    finish: chatFinish[completion.choices[0].finish_reason]!,
    usage: {
      input: completion.usage.prompt_tokens,
      output: completion.usage.completion_tokens,
      cacheRead: completion.usage.prompt_tokens_details.cached_tokens,
      reasoning: completion.usage.completion_tokens_details.reasoning_tokens
    }
  };
};

let anthropicFinish: Record<string, Finish> = {
  end_turn: 'stop',
  stop_sequence: 'stop',
  max_tokens: 'length',
  tool_use: 'tool-calls',
  refusal: 'content-filter'
};

let anthropicSummary = (message: any): Summary => ({
  text: message.content
    .flatMap((block: any) => (block.type == 'text' ? [block.text] : []))
    .join(''),
  reasoning: message.content.flatMap((block: any) =>
    block.type == 'thinking' && block.thinking ? [block.thinking] : []
  ),
  toolCalls: message.content.flatMap((block: any) =>
    block.type == 'tool_use' ? [{ id: block.id, name: block.name, input: block.input }] : []
  ),
  finish: anthropicFinish[message.stop_reason]!,
  usage: {
    input:
      message.usage.input_tokens +
      message.usage.cache_read_input_tokens +
      message.usage.cache_creation_input_tokens,
    output: message.usage.output_tokens,
    cacheRead: message.usage.cache_read_input_tokens,
    reasoning: 0
  }
});

let responsesSummary = (response: any): Summary => {
  let calls = response.output.filter((item: any) => item.type == 'function_call');

  return {
    text: response.output
      .flatMap((item: any) =>
        item.type == 'message' ? item.content.map((part: any) => part.text) : []
      )
      .join(''),
    reasoning: response.output.flatMap((item: any) =>
      item.type == 'reasoning'
        ? [...(item.content ?? []), ...item.summary]
            .map((part: any) => part.text)
            .filter(Boolean)
        : []
    ),
    toolCalls: calls.map((item: any) => ({
      id: item.call_id,
      name: item.name,
      input: JSON.parse(item.arguments)
    })),
    finish:
      response.status == 'incomplete'
        ? response.incomplete_details.reason == 'max_output_tokens'
          ? 'length'
          : 'content-filter'
        : calls.length
          ? 'tool-calls'
          : 'stop',
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: response.usage.input_tokens_details.cached_tokens,
      reasoning: response.usage.output_tokens_details.reasoning_tokens
    }
  };
};

// The SDK's stream helper adds parse results the plain create() call does not have.
let withoutParsed = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutParsed);
  if (!value || typeof value != 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key != 'parsed' && key != 'parsed_arguments')
      .map(([key, entry]) => [key, withoutParsed(entry)])
  );
};

let withoutAnthropicReasoningTokens = (summary: Summary): Summary => ({
  ...summary,
  usage: { ...summary.usage, reasoning: 0 }
});

describe.each(scenarios)('$name', ({ script }) => {
  let expected = expectedSummary(script);

  describe('openai chat', () => {
    let body = {
      model: 'openai/gpt-test',
      messages: [{ role: 'user' as const, content: 'Hi' }],
      tools: tools.map(tool => ({ type: 'function' as const, function: tool }))
    };

    it('non-streaming', async () => {
      let client = openaiClient(gatewayFetch('openai_chat', () => script).fetch);
      let completion = await client.chat.completions.create(body);

      expect(completion.object).toBe('chat.completion');
      expect(chatSummary(completion)).toEqual(expected);
    });

    it('streaming matches non-streaming', async () => {
      let client = openaiClient(gatewayFetch('openai_chat', () => script).fetch);
      let reasoning = '';
      let stream = client.chat.completions.stream({
        ...body,
        stream_options: { include_usage: true }
      });
      stream.on('chunk', chunk => {
        reasoning += (chunk.choices[0]?.delta as any)?.reasoning_content ?? '';
      });

      let completion = await stream.finalChatCompletion();
      expect(chatSummary(completion, reasoning ? [reasoning] : [])).toEqual(expected);
    });
  });

  describe('anthropic messages', () => {
    let body = {
      model: 'anthropic/claude-test',
      max_tokens: 1024,
      messages: [{ role: 'user' as const, content: 'Hi' }],
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters as any
      }))
    };

    it('non-streaming', async () => {
      let client = anthropicClient(gatewayFetch('anthropic_messages', () => script).fetch);
      let message = await client.messages.create(body);

      expect(message.type).toBe('message');
      expect(anthropicSummary(message)).toEqual(withoutAnthropicReasoningTokens(expected));
      expect(message.usage.cache_creation_input_tokens).toBe(usageOf(script).cacheWrite);
    });

    it('streaming matches non-streaming', async () => {
      let streamed = await anthropicClient(
        gatewayFetch('anthropic_messages', () => script).fetch
      )
        .messages.stream(body)
        .finalMessage();
      let direct = await anthropicClient(
        gatewayFetch('anthropic_messages', () => script).fetch
      ).messages.create(body);

      expect(anthropicSummary(streamed)).toEqual(withoutAnthropicReasoningTokens(expected));
      expect(streamed.content).toEqual(direct.content);
      expect(streamed.stop_reason).toEqual(direct.stop_reason);
      expect(streamed.stop_sequence).toEqual(direct.stop_sequence);
      expect(streamed.usage).toMatchObject(direct.usage);
    });
  });

  describe('open responses', () => {
    let body = {
      model: 'openai/gpt-test',
      input: 'Hi',
      tools: tools.map(tool => ({ type: 'function' as const, strict: false, ...tool }))
    };

    it('non-streaming', async () => {
      let client = openaiClient(gatewayFetch('open_responses', () => script).fetch);
      let response = await client.responses.create(body);

      expect(response.object).toBe('response');
      expect(responsesSummary(response)).toEqual(expected);
    });

    it('streaming matches non-streaming', async () => {
      let streamed = await openaiClient(gatewayFetch('open_responses', () => script).fetch)
        .responses.stream(body)
        .finalResponse();
      let direct = await openaiClient(
        gatewayFetch('open_responses', () => script).fetch
      ).responses.create(body);

      expect(responsesSummary(streamed)).toEqual(expected);
      expect(withoutParsed(streamed.output)).toEqual(direct.output);
      expect(streamed.status).toEqual(direct.status);
      expect(streamed.incomplete_details).toEqual(direct.incomplete_details);
      expect(streamed.usage).toEqual(direct.usage);
    });
  });
});
