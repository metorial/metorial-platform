import Anthropic from '@anthropic-ai/sdk';
import type { ScriptStep } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { dialectAdapters, encodeProviderMetadata } from '../src';
import { anthropicClient, gatewayFetch, parse, parseError, runDialect } from './harness';

let base = {
  model: 'anthropic/claude-test',
  max_tokens: 512,
  messages: [{ role: 'user', content: 'Hi' }]
};

let weatherTool = {
  name: 'get_weather',
  description: 'Weather for a city',
  input_schema: { type: 'object', properties: { city: { type: 'string' } } }
};

describe('anthropic messages: parsing the prompt', () => {
  it('maps system blocks with cache control', () => {
    let request = parse('anthropic_messages', {
      ...base,
      system: [
        {
          type: 'text',
          text: 'Long instructions',
          cache_control: { type: 'ephemeral', ttl: '1h' }
        },
        { type: 'text', text: 'Short' }
      ]
    });

    expect(request.options.prompt.slice(0, 2)).toEqual([
      {
        role: 'system',
        content: 'Long instructions',
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } }
      },
      { role: 'system', content: 'Short' }
    ]);
    expect(
      parse('anthropic_messages', { ...base, system: 'Plain' }).options.prompt[0]
    ).toEqual({
      role: 'system',
      content: 'Plain'
    });
  });

  it('maps a full tool loop, splitting tool results out of the user turn', () => {
    let request = parse('anthropic_messages', {
      ...base,
      messages: [
        { role: 'user', content: 'Weather?' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Checking.' },
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'get_weather',
              input: { city: 'Vienna' }
            },
            { type: 'tool_use', id: 'toolu_2', name: 'get_weather', input: { city: 'Oslo' } }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_1', content: '21°C' },
            {
              type: 'tool_result',
              tool_use_id: 'toolu_2',
              content: [{ type: 'text', text: 'Unavailable' }],
              is_error: true
            },
            { type: 'text', text: 'And tomorrow?' }
          ]
        }
      ]
    });

    expect(request.options.prompt).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Weather?' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Checking.' },
          {
            type: 'tool-call',
            toolCallId: 'toolu_1',
            toolName: 'get_weather',
            input: { city: 'Vienna' }
          },
          {
            type: 'tool-call',
            toolCallId: 'toolu_2',
            toolName: 'get_weather',
            input: { city: 'Oslo' }
          }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'toolu_1',
            toolName: 'get_weather',
            output: { type: 'text', value: '21°C' }
          },
          {
            type: 'tool-result',
            toolCallId: 'toolu_2',
            toolName: 'get_weather',
            output: { type: 'error-text', value: 'Unavailable' }
          }
        ]
      },
      { role: 'user', content: [{ type: 'text', text: 'And tomorrow?' }] }
    ]);
  });

  it('maps tool results that contain images to content output', () => {
    let request = parse('anthropic_messages', {
      ...base,
      messages: [
        { role: 'user', content: 'Screenshot please' },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't', name: 'screenshot', input: {} }]
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't',
              content: [
                { type: 'text', text: 'Here' },
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0=' }
                }
              ]
            }
          ]
        }
      ]
    });

    expect(request.options.prompt[2]).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 't',
          toolName: 'screenshot',
          output: {
            type: 'content',
            value: [
              { type: 'text', text: 'Here' },
              {
                type: 'file',
                data: { type: 'data', data: 'iVBORw0=' },
                mediaType: 'image/png'
              }
            ]
          }
        }
      ]
    });
  });

  it('maps images and documents of every supported source', () => {
    let request = parse('anthropic_messages', {
      ...base,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/webp', data: 'UklG' }
            },
            { type: 'image', source: { type: 'url', url: 'https://example.com/a.jpg' } },
            {
              type: 'document',
              title: 'Report',
              citations: { enabled: true },
              source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' },
              cache_control: { type: 'ephemeral' }
            },
            { type: 'document', source: { type: 'url', url: 'https://example.com/b.pdf' } },
            {
              type: 'document',
              source: { type: 'text', media_type: 'text/plain', data: 'Plain text doc' }
            },
            { type: 'text', text: 'Summarize', cache_control: { type: 'ephemeral' } }
          ]
        }
      ]
    });

    expect(request.options.prompt[0]!.content).toEqual([
      { type: 'file', mediaType: 'image/webp', data: { type: 'data', data: 'UklG' } },
      {
        type: 'file',
        mediaType: 'image',
        data: { type: 'url', url: new URL('https://example.com/a.jpg') }
      },
      {
        type: 'file',
        mediaType: 'application/pdf',
        data: { type: 'data', data: 'JVBERi0=' },
        filename: 'Report',
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' }, citations: { enabled: true } }
        }
      },
      {
        type: 'file',
        mediaType: 'application/pdf',
        data: { type: 'url', url: new URL('https://example.com/b.pdf') }
      },
      {
        type: 'file',
        mediaType: 'text/plain',
        data: { type: 'text', text: 'Plain text doc' }
      },
      {
        type: 'text',
        text: 'Summarize',
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
      }
    ]);
  });

  it('restores thinking signatures, native and enveloped, and redacted thinking', () => {
    let envelope = encodeProviderMetadata({
      openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc' }
    })!;
    let request = parse('anthropic_messages', {
      ...base,
      messages: [
        { role: 'user', content: 'Hi' },
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'Native', signature: 'EqQBCkYIBRgC' },
            { type: 'thinking', thinking: 'From OpenAI', signature: envelope },
            { type: 'thinking', thinking: 'Unsigned', signature: '' },
            { type: 'redacted_thinking', data: 'EmwKAhgB' },
            { type: 'text', text: 'Hello' }
          ]
        },
        { role: 'user', content: 'Again' }
      ]
    });

    expect(request.options.prompt[1]!.content).toEqual([
      {
        type: 'reasoning',
        text: 'Native',
        providerOptions: { anthropic: { signature: 'EqQBCkYIBRgC' } }
      },
      {
        type: 'reasoning',
        text: 'From OpenAI',
        providerOptions: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc' } }
      },
      { type: 'reasoning', text: 'Unsigned' },
      {
        type: 'reasoning',
        text: '',
        providerOptions: { anthropic: { redactedData: 'EmwKAhgB' } }
      },
      { type: 'text', text: 'Hello' }
    ]);
  });
});

describe('anthropic messages: parsing settings', () => {
  it('maps sampling, stop sequences and tools', () => {
    let request = parse('anthropic_messages', {
      ...base,
      temperature: 0.2,
      top_p: 0.8,
      top_k: 40,
      stop_sequences: ['###'],
      metadata: { user_id: 'u-1' },
      tools: [
        { ...weatherTool, cache_control: { type: 'ephemeral' } },
        { name: 'noop', type: 'custom' }
      ],
      tool_choice: { type: 'any', disable_parallel_tool_use: true },
      stream: true
    });

    expect(request.stream).toBe(true);
    expect(request.options).toMatchObject({
      maxOutputTokens: 512,
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      stopSequences: ['###'],
      toolChoice: { type: 'required' },
      providerOptions: {
        anthropic: { disableParallelToolUse: true },
        openai: { parallelToolCalls: false }
      }
    });
    expect(request.options.tools).toEqual([
      {
        type: 'function',
        name: 'get_weather',
        description: 'Weather for a city',
        inputSchema: weatherTool.input_schema,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
      },
      { type: 'function', name: 'noop', inputSchema: { type: 'object', properties: {} } }
    ]);
  });

  it('maps every tool_choice', () => {
    let choice = (tool_choice: unknown) =>
      parse('anthropic_messages', { ...base, tools: [weatherTool], tool_choice }).options
        .toolChoice;

    expect(choice({ type: 'auto' })).toEqual({ type: 'auto' });
    expect(choice({ type: 'none' })).toEqual({ type: 'none' });
    expect(choice({ type: 'any' })).toEqual({ type: 'required' });
    expect(choice({ type: 'tool', name: 'get_weather' })).toEqual({
      type: 'tool',
      toolName: 'get_weather'
    });
  });

  it.each([
    [1024, 'low'],
    [2048, 'low'],
    [4096, 'medium'],
    [8192, 'medium'],
    [32000, 'high']
  ])('maps a thinking budget of %i to the exact budget and a %s effort', (budget, effort) => {
    let request = parse('anthropic_messages', {
      ...base,
      thinking: { type: 'enabled', budget_tokens: budget }
    });

    expect(request.options.reasoning).toBe(effort);
    expect(request.options.providerOptions).toEqual({
      anthropic: { thinking: { type: 'enabled', budgetTokens: budget } }
    });
  });

  it('maps disabled and adaptive thinking', () => {
    let disabled = parse('anthropic_messages', { ...base, thinking: { type: 'disabled' } });
    expect(disabled.options.reasoning).toBe('none');
    expect(disabled.options.providerOptions).toEqual({
      anthropic: { thinking: { type: 'disabled' } }
    });

    let adaptive = parse('anthropic_messages', { ...base, thinking: { type: 'adaptive' } });
    expect(adaptive.options.reasoning).toBeUndefined();
    expect(adaptive.options.providerOptions).toEqual({
      anthropic: { thinking: { type: 'adaptive' } }
    });
  });

  it('maps output_config effort and json schema format', () => {
    let request = parse('anthropic_messages', {
      ...base,
      thinking: { type: 'enabled', budget_tokens: 2000 },
      output_config: {
        effort: 'max',
        format: { type: 'json_schema', schema: { type: 'object' } }
      }
    });

    expect(request.options.reasoning).toBe('max');
    expect(request.options.responseFormat).toEqual({
      type: 'json',
      schema: { type: 'object' }
    });
    expect(request.options.providerOptions).toEqual({
      anthropic: { thinking: { type: 'enabled', budgetTokens: 2000 }, effort: 'max' }
    });
  });

  it('only requires max_tokens for generation, not for token counting', () => {
    let { max_tokens: _, ...withoutMax } = base;

    expect(parseError('anthropic_messages', withoutMax)).toMatchObject({
      param: 'max_tokens'
    });

    let counted = dialectAdapters.anthropic_messages.parseRequest(
      { ...withoutMax, stream: true },
      { countTokens: true }
    );
    expect(counted.options.maxOutputTokens).toBeUndefined();
    expect(counted.stream).toBe(false);
  });
});

describe('anthropic messages: rejections', () => {
  let cases: [string, Record<string, unknown>, string, string][] = [
    ['containers', { container: 'cntr_1' }, 'container', 'unsupported_parameter'],
    [
      'MCP servers',
      { mcp_servers: [{ type: 'url', url: 'https://x', name: 'x' }] },
      'mcp_servers',
      'unsupported_parameter'
    ],
    [
      'context management',
      { context_management: { edits: [{ type: 'clear_tool_uses_20250919' }] } },
      'context_management',
      'unsupported_parameter'
    ],
    [
      'server tools',
      { tools: [{ type: 'web_search_20250305', name: 'web_search' }] },
      'tools[0].type',
      'unsupported_parameter'
    ],
    [
      'an unknown forced tool',
      { tools: [weatherTool], tool_choice: { type: 'tool', name: 'other' } },
      'tool_choice.name',
      'invalid_request'
    ],
    [
      'an unknown tool_choice',
      { tool_choice: { type: 'sometimes' } },
      'tool_choice.type',
      'invalid_request'
    ],
    [
      'a thinking budget below 1024',
      { thinking: { type: 'enabled', budget_tokens: 100 } },
      'thinking.budget_tokens',
      'invalid_request'
    ],
    ['a temperature above 1', { temperature: 1.5 }, 'temperature', 'invalid_request'],
    [
      'an unknown cache ttl',
      {
        system: [{ type: 'text', text: 'x', cache_control: { type: 'ephemeral', ttl: '1d' } }]
      },
      'system[0].cache_control.ttl',
      'invalid_request'
    ],
    [
      'a system message role',
      { messages: [{ role: 'system', content: 'x' }] },
      'messages[0].role',
      'invalid_request'
    ],
    ['empty messages', { messages: [] }, 'messages', 'invalid_request'],
    [
      'search result blocks',
      {
        messages: [
          {
            role: 'user',
            content: [{ type: 'search_result', source: 'x', title: 't', content: [] }]
          }
        ]
      },
      'messages[0].content[0].type',
      'unsupported_parameter'
    ],
    [
      'server tool use blocks',
      {
        messages: [
          { role: 'user', content: 'x' },
          {
            role: 'assistant',
            content: [{ type: 'server_tool_use', id: 's', name: 'web_search', input: {} }]
          }
        ]
      },
      'messages[1].content[0].type',
      'unsupported_parameter'
    ],
    [
      'file-id images',
      {
        messages: [
          {
            role: 'user',
            content: [{ type: 'image', source: { type: 'file', file_id: 'f' } }]
          }
        ]
      },
      'messages[0].content[0].source.type',
      'unsupported_parameter'
    ],
    [
      'content documents',
      {
        messages: [
          {
            role: 'user',
            content: [{ type: 'document', source: { type: 'content', content: [] } }]
          }
        ]
      },
      'messages[0].content[0].source.type',
      'unsupported_parameter'
    ],
    [
      'a tool result without a matching call',
      {
        messages: [
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'nope', content: 'x' }]
          }
        ]
      },
      'messages[0].content[0].tool_use_id',
      'invalid_request'
    ]
  ];

  it.each(cases)('rejects %s', (_name, patch, param, code) => {
    expect(parseError('anthropic_messages', { ...base, ...patch })).toMatchObject({
      status: 400,
      param,
      code
    });
  });

  it('surfaces rejections through the Anthropic SDK', async () => {
    let client = anthropicClient(
      gatewayFetch('anthropic_messages', () => ({ steps: [] })).fetch
    );
    let error = await client.messages
      .create({ ...(base as any), container: 'x' })
      .catch(error => error);

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(error.status).toBe(400);
    expect(error.error).toEqual({
      type: 'error',
      error: { type: 'invalid_request_error', message: expect.stringContaining('containers') }
    });
  });
});

describe('anthropic messages: responses', () => {
  it('builds the exact message object', async () => {
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: base,
      script: {
        steps: [{ type: 'text', text: 'Hello!' }],
        usage: { input: 10, output: 5, cacheRead: 300, cacheWrite: 50 }
      }
    });

    expect(run.response).toEqual({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'gateway/test-model',
      content: [{ type: 'text', text: 'Hello!' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      stop_details: null,
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 300
      }
    });
  });

  it('reports the matched stop sequence', async () => {
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: { ...base, stop_sequences: ['###'] },
      script: {
        finish: 'stop-sequence',
        finishMetadata: { anthropic: { stopSequence: '###' } },
        steps: [{ type: 'text', text: 'Done' }]
      }
    });

    expect(run.response.stop_reason).toBe('stop_sequence');
    expect(run.response.stop_sequence).toBe('###');
  });

  it('passes native Anthropic signatures through and envelopes foreign metadata', async () => {
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: base,
      script: {
        steps: [
          {
            type: 'reasoning',
            text: 'Native',
            metadata: { anthropic: { signature: 'EqQBCkYIBRgC' } }
          },
          {
            type: 'reasoning',
            text: 'Gemini',
            metadata: { google: { thoughtSignature: 'g' } }
          },
          { type: 'reasoning', text: 'Plain' },
          {
            type: 'reasoning',
            text: '',
            redacted: 'EmwKAhgB',
            metadata: { anthropic: { redactedData: 'EmwKAhgB' } }
          },
          { type: 'text', text: 'Hi' }
        ]
      }
    });

    expect(run.response.content).toEqual([
      { type: 'thinking', thinking: 'Native', signature: 'EqQBCkYIBRgC' },
      {
        type: 'thinking',
        thinking: 'Gemini',
        signature: encodeProviderMetadata({ google: { thoughtSignature: 'g' } })
      },
      { type: 'thinking', thinking: 'Plain', signature: '' },
      { type: 'redacted_thinking', data: 'EmwKAhgB' },
      { type: 'text', text: 'Hi' }
    ]);
  });

  it('round-trips every reasoning block back into the same provider options', async () => {
    let steps: Extract<ScriptStep, { type: 'reasoning' }>[] = [
      { type: 'reasoning', text: 'A', metadata: { anthropic: { signature: 'sig-a' } } },
      {
        type: 'reasoning',
        text: 'B',
        metadata: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc' } }
      },
      {
        type: 'reasoning',
        text: '',
        redacted: 'red',
        metadata: { anthropic: { redactedData: 'red' } }
      }
    ];
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: base,
      script: { steps: [...steps, { type: 'text', text: 'ok' }] }
    });

    let next = parse('anthropic_messages', {
      ...base,
      messages: [
        ...base.messages,
        { role: 'assistant', content: run.response.content },
        { role: 'user', content: 'More' }
      ]
    });

    expect(next.options.prompt[1]!.content).toEqual([
      ...steps.map(step => ({
        type: 'reasoning',
        text: step.text,
        providerOptions: step.metadata
      })),
      { type: 'text', text: 'ok' }
    ]);
  });

  it('maps finish reasons', async () => {
    let stopReason = async (finish: any) =>
      (
        await runDialect({
          dialect: 'anthropic_messages',
          body: base,
          script: { finish, steps: [{ type: 'text', text: 'x' }] }
        })
      ).response.stop_reason;

    expect(await stopReason('stop')).toBe('end_turn');
    expect(await stopReason('length')).toBe('max_tokens');
    expect(await stopReason('tool-calls')).toBe('tool_use');
    expect(await stopReason('content-filter')).toBe('refusal');
    expect(await stopReason('stop-sequence')).toBe('stop_sequence');
  });

  it('returns tool inputs as objects, and an empty object for empty input', async () => {
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: { ...base, tools: [weatherTool] },
      script: {
        steps: [
          { type: 'tool-call', id: 'toolu_1', name: 'get_weather', input: { city: 'Lima' } },
          { type: 'tool-call', id: 'toolu_2', name: 'get_weather', input: {} }
        ]
      }
    });

    expect(run.response.content).toEqual([
      { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Lima' } },
      { type: 'tool_use', id: 'toolu_2', name: 'get_weather', input: {} }
    ]);
    expect(run.response.stop_reason).toBe('tool_use');
  });
});

describe('anthropic messages: streaming', () => {
  let typesOf = (run: { events?: { event?: string; json?: any }[] }) =>
    run.events!.map(event => {
      expect(event.event).toBe(event.json.type);
      return event.json.delta?.type ? `${event.event}:${event.json.delta.type}` : event.event;
    });

  it('streams the exact event sequence for text', async () => {
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: { ...base, stream: true },
      script: {
        chunkSize: 3,
        steps: [{ type: 'text', text: 'Hello' }],
        usage: { input: 9, output: 2, cacheRead: 1 }
      }
    });

    expect(run.events!.map(event => event.json)).toEqual([
      {
        type: 'message_start',
        message: {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: 'gateway/test-model',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          stop_details: null,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        }
      },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hel' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'lo' } },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null, stop_details: null },
        usage: {
          input_tokens: 9,
          output_tokens: 2,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 1
        }
      },
      { type: 'message_stop' }
    ]);
  });

  it('streams thinking with the signature as a signature_delta before the block stops', async () => {
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: { ...base, stream: true },
      script: {
        chunkSize: 5,
        steps: [
          {
            type: 'reasoning',
            text: 'Hmm, ok',
            metadata: { anthropic: { signature: 'EqQB' } }
          },
          { type: 'text', text: 'Hi' }
        ]
      }
    });

    expect(run.events!.slice(1, 8).map(event => event.json)).toEqual([
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking', thinking: '', signature: '' }
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'Hmm, ' }
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'ok' }
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'signature_delta', signature: 'EqQB' }
      },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Hi' } }
    ]);
  });

  it('streams redacted thinking as a single block with its data', async () => {
    let metadata = { anthropic: { redactedData: 'EmwK' } };
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: { ...base, stream: true },
      script: {
        steps: [
          { type: 'reasoning', text: '', redacted: 'EmwK', metadata, startMetadata: metadata }
        ]
      }
    });

    expect(run.events!.slice(1, 3).map(event => event.json)).toEqual([
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'redacted_thinking', data: 'EmwK' }
      },
      { type: 'content_block_stop', index: 0 }
    ]);
  });

  it('streams tool use as input_json_delta fragments', async () => {
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: { ...base, stream: true, tools: [weatherTool] },
      script: {
        chunkSize: 8,
        steps: [
          { type: 'text', text: 'Checking' },
          { type: 'tool-call', id: 'toolu_1', name: 'get_weather', input: { city: 'Vienna' } },
          {
            type: 'tool-call',
            id: 'toolu_2',
            name: 'get_weather',
            input: { city: 'Rome' },
            streamInput: false
          },
          {
            type: 'tool-call',
            id: 'toolu_3',
            name: 'get_weather',
            input: {},
            streamInput: false
          }
        ]
      }
    });

    expect(typesOf(run)).toEqual([
      'message_start',
      'content_block_start',
      'content_block_delta:text_delta',
      'content_block_stop',
      'content_block_start',
      'content_block_delta:input_json_delta',
      'content_block_delta:input_json_delta',
      'content_block_delta:input_json_delta',
      'content_block_stop',
      'content_block_start',
      'content_block_delta:input_json_delta',
      'content_block_stop',
      'content_block_start',
      'content_block_delta:input_json_delta',
      'content_block_stop',
      'message_delta',
      'message_stop'
    ]);
    expect(run.events![4]!.json).toEqual({
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: {} }
    });
    expect(
      run
        .events!.filter(event => event.json.type == 'content_block_start')
        .map(event => event.json.index)
    ).toEqual([0, 1, 2, 3]);
    expect(run.events!.at(-2)!.json.delta.stop_reason).toBe('tool_use');
  });

  it('produces the same final message through the SDK as a non-streaming call', async () => {
    let script = {
      steps: [
        {
          type: 'reasoning' as const,
          text: 'Plan',
          metadata: { anthropic: { signature: 'sig' } }
        },
        { type: 'text' as const, text: 'Calling' },
        {
          type: 'tool-call' as const,
          id: 'toolu_1',
          name: 'get_weather',
          input: { city: 'Bern' }
        }
      ],
      usage: { input: 5, output: 9, cacheWrite: 7 }
    };

    let streamed = await anthropicClient(
      gatewayFetch('anthropic_messages', () => script).fetch
    )
      .messages.stream({ ...(base as any), tools: [weatherTool] })
      .finalMessage();
    let direct = await anthropicClient(
      gatewayFetch('anthropic_messages', () => script).fetch
    ).messages.create({
      ...(base as any),
      tools: [weatherTool]
    });

    let { parsed_output: _, ...streamedMessage } = streamed as any;
    expect(streamedMessage).toEqual(direct);
  });

  it('emits an error event on failure that makes the SDK throw', async () => {
    let script = {
      steps: [{ type: 'text' as const, text: 'Partial' }],
      failMidStream: { message: 'boom' }
    };
    let run = await runDialect({
      dialect: 'anthropic_messages',
      body: { ...base, stream: true },
      script
    });

    expect(run.events!.at(-1)).toMatchObject({
      event: 'error',
      json: {
        type: 'error',
        error: { type: 'api_error', message: 'The upstream provider failed mid-stream.' }
      }
    });

    let error = await anthropicClient(gatewayFetch('anthropic_messages', () => script).fetch)
      .messages.stream(base as any)
      .finalMessage()
      .catch(error => error);
    expect(error).toBeInstanceOf(Anthropic.APIError);
    expect(error.message).toContain('The upstream provider failed mid-stream.');
  });
});
