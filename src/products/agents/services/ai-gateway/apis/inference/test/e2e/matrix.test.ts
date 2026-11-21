import type { Dialect } from '@mtsrc/ai-gateway-dialects';
import type { Script } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { ask, type Ask, type Finish, type ToolCall } from './clients';
import { createGateway, providerCases } from './harness';

let weatherTool = {
  name: 'get_weather',
  description: 'Look up the weather',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string' }, unit: { type: 'string' } },
    required: ['city']
  }
};

type Scenario = {
  name: string;
  script: Script;
  ask: Ask;
  expected: {
    text: string;
    reasoning?: string;
    toolCalls?: Omit<ToolCall, 'id'>[];
    finish: Finish;
  };
};

let scenarios: Scenario[] = [
  {
    name: 'plain text',
    script: {
      steps: [{ type: 'text', text: 'Hello from the gateway, with ünïcödé ✓.' }],
      usage: { input: 21, output: 9 }
    },
    ask: { system: 'Be brief.', prompt: 'Say hello' },
    expected: { text: 'Hello from the gateway, with ünïcödé ✓.', finish: 'stop' }
  },
  {
    name: 'a tool call after text',
    script: {
      steps: [
        { type: 'text', text: 'Let me check.' },
        {
          type: 'tool-call',
          id: 'call_weather_1',
          name: 'get_weather',
          input: { city: 'Berlin', unit: 'c' }
        }
      ],
      usage: { input: 40, output: 12 }
    },
    ask: { prompt: 'Weather in Berlin?', tools: [weatherTool] },
    expected: {
      text: 'Let me check.',
      toolCalls: [{ name: 'get_weather', args: { city: 'Berlin', unit: 'c' } }],
      finish: 'tool_calls'
    }
  },
  {
    name: 'parallel tool calls',
    script: {
      steps: [
        { type: 'tool-call', id: 'call_a', name: 'get_weather', input: { city: 'Paris' } },
        { type: 'tool-call', id: 'call_b', name: 'get_weather', input: { city: 'Tokyo' } }
      ],
      usage: { input: 40, output: 20 }
    },
    ask: { prompt: 'Weather in Paris and Tokyo?', tools: [weatherTool] },
    expected: {
      text: '',
      toolCalls: [
        { name: 'get_weather', args: { city: 'Paris' } },
        { name: 'get_weather', args: { city: 'Tokyo' } }
      ],
      finish: 'tool_calls'
    }
  },
  {
    name: 'reasoning before the answer',
    script: {
      steps: [
        {
          type: 'reasoning',
          text: 'The user wants a number, 6 times 7.',
          signature: 'sig_reasoning_1'
        },
        { type: 'text', text: '42' }
      ],
      usage: { input: 15, output: 30, reasoning: 20 }
    },
    ask: { prompt: 'What is 6 times 7?' },
    expected: { text: '42', reasoning: 'The user wants a number, 6 times 7.', finish: 'stop' }
  },
  {
    name: 'a response cut off at the token limit',
    script: {
      steps: [{ type: 'text', text: 'Once upon a time there was a' }],
      finish: 'length',
      usage: { input: 10, output: 8 }
    },
    ask: { prompt: 'Tell me a story', maxTokens: 8 },
    expected: { text: 'Once upon a time there was a', finish: 'length' }
  }
];

let dialects: Dialect[] = ['openai_chat', 'open_responses', 'anthropic_messages'];

describe.each(providerCases.map(provider => [provider.slug, provider] as const))(
  'through %s',
  (_, provider) => {
    describe.each(dialects)('with the %s API', dialect => {
      for (let scenario of scenarios) {
        for (let stream of [false, true]) {
          it(`answers ${scenario.name} ${stream ? 'streamed' : 'buffered'}`, async () => {
            let gateway = createGateway({ providers: [provider], upstream: scenario.script });

            let turn = await ask(gateway, dialect, scenario.ask, { stream });

            expect(turn.text).toBe(scenario.expected.text);
            expect(turn.toolCalls.map(({ name, args }) => ({ name, args }))).toEqual(
              scenario.expected.toolCalls ?? []
            );
            expect(turn.finish).toBe(scenario.expected.finish);
            if (scenario.expected.reasoning)
              expect(turn.reasoning).toBe(scenario.expected.reasoning);

            expect(turn.usage.input).toBe(scenario.script.usage!.input);
            expect(turn.usage.output).toBe(scenario.script.usage!.output);

            // Clients must be able to send every tool call id back with its result.
            let ids = turn.toolCalls.map(call => call.id);
            expect(ids.every(id => id.length > 0)).toBe(true);
            expect(new Set(ids).size).toBe(ids.length);

            expect(gateway.upstream.requests).toHaveLength(1);
            expect(gateway.logs).toHaveLength(1);
            expect(gateway.logs[0]!.log).toMatchObject({
              status: 'succeeded',
              dialect,
              operation: stream ? 'stream' : 'generate',
              route: { providerSlug: provider.slug, vendorModelId: provider.modelId },
              usage: {
                input: { total: scenario.script.usage!.input },
                output: { total: scenario.script.usage!.output }
              }
            });
            expect(gateway.logs[0]!.log.billedCost!.totalUsd).toBeGreaterThan(0);
          });
        }
      }
    });
  }
);
