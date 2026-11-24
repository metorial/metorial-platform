import type Anthropic from '@anthropic-ai/sdk';
import type { Dialect } from '@mtsrc/ai-gateway-dialects';
import { describe, expect, it } from 'vitest';
import { model } from './clients';
import {
  createGateway,
  lastUpstreamBody,
  providerCases,
  providerCase,
  type Gateway
} from './harness';

// Newer SDKs no longer type the sampling parameters older clients still send.
type LegacyMessageParams = Anthropic.MessageCreateParamsNonStreaming & {
  temperature?: number;
  top_k?: number;
};

let weatherSchema = { type: 'object', properties: { city: { type: 'string' } } };

// One tool-using conversation, written the way each API expresses it. Every API must reach a
// given provider as the exact same upstream request.
let conversations: Record<Dialect, (gateway: Gateway) => Promise<unknown>> = {
  openai_chat: gateway =>
    gateway.openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_completion_tokens: 300,
      tool_choice: 'required',
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Look up the weather',
            parameters: weatherSchema
          }
        }
      ],
      messages: [
        { role: 'system', content: 'You are terse.' },
        { role: 'user', content: 'Weather in Berlin?' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"city":"Berlin"}' }
            }
          ]
        },
        { role: 'tool', tool_call_id: 'call_1', content: 'Sunny, 21C' },
        { role: 'user', content: 'Thanks. And tomorrow?' }
      ]
    }),

  open_responses: gateway =>
    gateway.openai.responses.create({
      model,
      temperature: 0.2,
      max_output_tokens: 300,
      instructions: 'You are terse.',
      tool_choice: 'required',
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Look up the weather',
          parameters: weatherSchema,
          strict: null
        }
      ],
      input: [
        { role: 'user', content: 'Weather in Berlin?' },
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'get_weather',
          arguments: '{"city":"Berlin"}'
        },
        { type: 'function_call_output', call_id: 'call_1', output: 'Sunny, 21C' },
        { role: 'user', content: 'Thanks. And tomorrow?' }
      ]
    }),

  anthropic_messages: gateway =>
    gateway.anthropic.messages.create(<LegacyMessageParams>{
      model,
      temperature: 0.2,
      max_tokens: 300,
      system: 'You are terse.',
      tool_choice: { type: 'any' },
      tools: [
        {
          name: 'get_weather',
          description: 'Look up the weather',
          input_schema: { type: 'object', properties: { city: { type: 'string' } } }
        }
      ],
      messages: [
        { role: 'user', content: 'Weather in Berlin?' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { city: 'Berlin' } }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'call_1', content: 'Sunny, 21C' },
            { type: 'text', text: 'Thanks. And tomorrow?' }
          ]
        }
      ]
    })
};

let dialects = Object.keys(conversations) as Dialect[];

let upstreamBodyFor = async (provider: string, dialect: Dialect) => {
  let gateway = createGateway({
    providers: [provider],
    upstream: { steps: [{ type: 'text', text: 'ok' }] }
  });
  await conversations[dialect](gateway);
  return lastUpstreamBody(gateway);
};

describe('every API reaches a provider as the same request', () => {
  for (let provider of providerCases) {
    it(`for ${provider.slug}`, async () => {
      let [reference, ...others] = await Promise.all(
        dialects.map(dialect => upstreamBodyFor(provider.slug, dialect))
      );

      for (let other of others) expect(other).toEqual(reference);
    });
  }
});

let responsesWire = {
  input: [
    { role: 'developer', content: 'You are terse.' },
    { role: 'user', content: [{ type: 'input_text', text: 'Weather in Berlin?' }] },
    {
      type: 'function_call',
      call_id: 'call_1',
      name: 'get_weather',
      arguments: '{"city":"Berlin"}'
    },
    { type: 'function_call_output', call_id: 'call_1', output: 'Sunny, 21C' },
    { role: 'user', content: [{ type: 'input_text', text: 'Thanks. And tomorrow?' }] }
  ],
  max_output_tokens: 300,
  store: false,
  include: ['reasoning.encrypted_content'],
  tools: [
    {
      type: 'function',
      name: 'get_weather',
      description: 'Look up the weather',
      parameters: weatherSchema,
      strict: false
    }
  ],
  tool_choice: 'required',
  stream: true
};

let chatMessages = [
  { role: 'system', content: 'You are terse.' },
  { role: 'user', content: 'Weather in Berlin?' },
  {
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"city":"Berlin"}' }
      }
    ]
  },
  { role: 'tool', tool_call_id: 'call_1', content: 'Sunny, 21C' },
  { role: 'user', content: 'Thanks. And tomorrow?' }
];

let chatTools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Look up the weather',
      parameters: weatherSchema
    }
  }
];

let expectedWires: Record<string, unknown> = {
  // Reasoning models take no temperature; the provider drops it.
  openai: { model: 'gpt-5-mini', ...responsesWire },
  azure: { model: 'gpt-5-mini', ...responsesWire },
  anthropic: {
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    temperature: 0.2,
    system: [{ type: 'text', text: 'You are terse.' }],
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Weather in Berlin?' }] },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { city: 'Berlin' } }
        ]
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'call_1', content: 'Sunny, 21C' },
          { type: 'text', text: 'Thanks. And tomorrow?' }
        ]
      }
    ],
    tools: [
      {
        name: 'get_weather',
        description: 'Look up the weather',
        input_schema: weatherSchema,
        eager_input_streaming: true
      }
    ],
    tool_choice: { type: 'any' },
    stream: true
  },
  'google-ai-studio': {
    generationConfig: { maxOutputTokens: 300, temperature: 0.2 },
    systemInstruction: { parts: [{ text: 'You are terse.' }] },
    contents: [
      { role: 'user', parts: [{ text: 'Weather in Berlin?' }] },
      {
        role: 'model',
        parts: [
          { functionCall: { id: 'call_1', name: 'get_weather', args: { city: 'Berlin' } } }
        ]
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: 'call_1',
              name: 'get_weather',
              response: { name: 'get_weather', content: 'Sunny, 21C' }
            }
          }
        ]
      },
      { role: 'user', parts: [{ text: 'Thanks. And tomorrow?' }] }
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: 'get_weather',
            description: 'Look up the weather',
            parametersJsonSchema: weatherSchema
          }
        ]
      }
    ],
    toolConfig: { functionCallingConfig: { mode: 'ANY' } }
  },
  groq: {
    model: 'openai/gpt-oss-120b',
    max_tokens: 300,
    temperature: 0.2,
    messages: chatMessages,
    tools: chatTools,
    tool_choice: 'required',
    stream: true
  },
  deepseek: {
    model: 'deepseek-reasoner',
    max_tokens: 300,
    messages: chatMessages,
    tools: chatTools,
    tool_choice: 'required',
    stream: true,
    stream_options: { include_usage: true }
  },
  mistral: {
    model: 'mistral-large-latest',
    max_tokens: 300,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You are terse.' },
      { role: 'user', content: [{ type: 'text', text: 'Weather in Berlin?' }] },
      chatMessages[2],
      { role: 'tool', name: 'get_weather', tool_call_id: 'call_1', content: 'Sunny, 21C' },
      { role: 'user', content: [{ type: 'text', text: 'Thanks. And tomorrow?' }] }
    ],
    tools: chatTools,
    tool_choice: 'any',
    stream: true
  },
  cohere: {
    model: 'command-a-reasoning',
    max_tokens: 300,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You are terse.' },
      { role: 'user', content: 'Weather in Berlin?' },
      {
        role: 'assistant',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city":"Berlin"}' }
          }
        ]
      },
      { role: 'tool', content: 'Sunny, 21C', tool_call_id: 'call_1' },
      { role: 'user', content: 'Thanks. And tomorrow?' }
    ],
    tools: chatTools,
    tool_choice: 'REQUIRED',
    stream: true
  }
};

describe('the upstream request is each vendor’s native format', () => {
  for (let [slug, expected] of Object.entries(expectedWires)) {
    it(`for ${slug}`, async () => {
      expect(await upstreamBodyFor(slug, 'openai_chat')).toEqual(expected);
    });
  }

  it('sends xAI the Responses format with temperature', async () => {
    expect(await upstreamBodyFor('xai', 'openai_chat')).toMatchObject({
      model: 'grok-4',
      temperature: 0.2,
      max_output_tokens: 300,
      tool_choice: 'required',
      store: false
    });
  });

  it('authenticates every upstream with the connection credentials only', async () => {
    for (let provider of providerCases) {
      let gateway = createGateway({
        providers: [provider],
        upstream: { steps: [{ type: 'text', text: 'ok' }] }
      });
      await conversations.openai_chat(gateway);

      let headers = gateway.upstream.requests[0]!.headers;
      let serialized = JSON.stringify(headers);
      expect(serialized).toContain('sk-upstream-secret');
      expect(serialized).not.toContain('gateway-token');
    }
  });
});

let pixel =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let pdf = Buffer.from('%PDF-1.4 tiny').toString('base64');

let mediaRequests: Record<Dialect, (gateway: Gateway) => Promise<unknown>> = {
  openai_chat: gateway =>
    gateway.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe these.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${pixel}` } },
            {
              type: 'file',
              file: { filename: 'doc.pdf', file_data: `data:application/pdf;base64,${pdf}` }
            }
          ]
        }
      ]
    }),

  open_responses: gateway =>
    gateway.openai.responses.create({
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Describe these.' },
            {
              type: 'input_image',
              image_url: `data:image/png;base64,${pixel}`,
              detail: 'auto'
            },
            {
              type: 'input_file',
              filename: 'doc.pdf',
              file_data: `data:application/pdf;base64,${pdf}`
            }
          ]
        }
      ]
    }),

  anthropic_messages: gateway =>
    gateway.anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe these.' },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: pixel }
            },
            {
              type: 'document',
              title: 'doc.pdf',
              source: { type: 'base64', media_type: 'application/pdf', data: pdf }
            }
          ]
        }
      ]
    })
};

describe('images and documents', () => {
  let mediaBody = async (provider: string, dialect: Dialect) => {
    let gateway = createGateway({
      providers: [provider],
      upstream: { steps: [{ type: 'text', text: 'ok' }] }
    });
    await mediaRequests[dialect](gateway);
    return lastUpstreamBody(gateway);
  };

  for (let provider of ['anthropic', 'openai', 'google-ai-studio']) {
    it(`reach ${provider} natively from every API`, async () => {
      let bodies = await Promise.all(dialects.map(dialect => mediaBody(provider, dialect)));
      let serialized = JSON.stringify(bodies[0]);

      expect(serialized).toContain(pixel);
      expect(serialized).toContain(pdf);
      for (let body of bodies.slice(1)) {
        expect(JSON.stringify(body)).toContain(pixel);
        expect(JSON.stringify(body)).toContain(pdf);
      }
    });
  }

  it('sends Anthropic base64 image and document blocks', async () => {
    let body = await mediaBody('anthropic', 'openai_chat');

    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'Describe these.' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pixel } },
      expect.objectContaining({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdf }
      })
    ]);
  });

  it('sends Google inline data', async () => {
    let body = await mediaBody('google-ai-studio', 'anthropic_messages');

    expect(body.contents[0].parts).toEqual([
      { text: 'Describe these.' },
      { inlineData: { mimeType: 'image/png', data: pixel } },
      { inlineData: { mimeType: 'application/pdf', data: pdf } }
    ]);
  });
});

describe('sampling parameters', () => {
  it('passes stop sequences from OpenAI Chat and Anthropic to providers that take them', async () => {
    let chat = createGateway({
      providers: ['anthropic'],
      upstream: { steps: [{ type: 'text', text: 'ok' }] }
    });
    await chat.openai.chat.completions.create({
      model,
      stop: ['END', 'STOP'],
      top_p: 0.9,
      seed: 7,
      messages: [{ role: 'user', content: 'hi' }]
    });

    let messages = createGateway({
      providers: ['groq'],
      upstream: { steps: [{ type: 'text', text: 'ok' }] }
    });
    await messages.anthropic.messages.create(<LegacyMessageParams>{
      model,
      max_tokens: 50,
      stop_sequences: ['END'],
      top_k: 40,
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(lastUpstreamBody(chat)).toMatchObject({
      stop_sequences: ['END', 'STOP'],
      top_p: 0.9
    });
    expect(lastUpstreamBody(messages)).toMatchObject({ stop: ['END'], max_tokens: 50 });
  });

  it('turns JSON schema output into each vendor’s structured output', async () => {
    let schema = {
      type: 'object',
      properties: { answer: { type: 'string' } },
      required: ['answer']
    };
    let responseFormat = {
      type: 'json_schema' as const,
      json_schema: { name: 'answer', schema, strict: true }
    };

    let openai = createGateway({
      providers: ['openai'],
      upstream: { steps: [{ type: 'text', text: '{}' }] }
    });
    await openai.openai.chat.completions.create({
      model,
      response_format: responseFormat,
      messages: [{ role: 'user', content: 'hi' }]
    });

    let google = createGateway({
      providers: ['google-ai-studio'],
      upstream: { steps: [{ type: 'text', text: '{}' }] }
    });
    await google.openai.chat.completions.create({
      model,
      response_format: responseFormat,
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(lastUpstreamBody(openai).text.format).toMatchObject({
      type: 'json_schema',
      name: 'answer',
      schema
    });
    expect(lastUpstreamBody(google).generationConfig).toMatchObject({
      responseMimeType: 'application/json'
    });
  });

  it('maps reasoning effort onto each vendor’s reasoning controls', async () => {
    let openai = createGateway({
      providers: ['openai'],
      upstream: { steps: [{ type: 'text', text: 'ok' }] }
    });
    await openai.openai.chat.completions.create({
      model,
      reasoning_effort: 'high',
      messages: [{ role: 'user', content: 'hi' }]
    });

    let anthropic = createGateway({
      providers: ['anthropic'],
      upstream: { steps: [{ type: 'text', text: 'ok' }] }
    });
    await anthropic.anthropic.messages.create({
      model,
      max_tokens: 8000,
      thinking: { type: 'enabled', budget_tokens: 4000 },
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(lastUpstreamBody(openai).reasoning).toMatchObject({ effort: 'high' });
    expect(lastUpstreamBody(anthropic).thinking).toEqual({
      type: 'enabled',
      budget_tokens: 4000
    });
  });

  it('keeps Anthropic prompt caching breakpoints', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: { steps: [{ type: 'text', text: 'ok' }] }
    });
    await gateway.anthropic.messages.create({
      model,
      max_tokens: 100,
      system: [
        { type: 'text', text: 'Long context', cache_control: { type: 'ephemeral', ttl: '1h' } }
      ],
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Question', cache_control: { type: 'ephemeral' } }]
        }
      ]
    });

    let body = lastUpstreamBody(gateway);
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(body.messages[0].content[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('uses the vendor model id of the route, not the requested name', async () => {
    let gateway = createGateway({
      providers: [providerCase('anthropic')],
      upstream: { steps: [{ type: 'text', text: 'ok' }] }
    });
    await gateway.openai.chat.completions.create({
      model: 'my-alias',
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(lastUpstreamBody(gateway).model).toBe('claude-sonnet-4-5');
  });
});
