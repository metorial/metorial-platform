import { APIError } from 'openai';
import { describe, expect, it } from 'vitest';
import { decodeProviderMetadata, encodeProviderMetadata } from '../src';
import { gatewayFetch, openaiClient, parse, parseError, runDialect } from './harness';

let base = { model: 'openai/gpt-test', messages: [{ role: 'user', content: 'Hi' }] };

let weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Weather for a city',
    parameters: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city']
    }
  }
};

describe('openai chat: parsing messages', () => {
  it('maps system, developer, user, assistant and tool messages to an AI SDK prompt', () => {
    let request = parse('openai_chat', {
      model: 'openai/gpt-test',
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'developer', content: [{ type: 'text', text: 'Use metric units.' }] },
        { role: 'user', content: 'Weather in Vienna and Paris?' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"city":"Vienna"}' }
            },
            {
              id: 'call_2',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"city":"Paris"}' }
            }
          ]
        },
        { role: 'tool', tool_call_id: 'call_1', content: '21°C' },
        { role: 'tool', tool_call_id: 'call_2', content: [{ type: 'text', text: '18°C' }] },
        { role: 'assistant', content: 'Vienna 21°C, Paris 18°C.' },
        { role: 'user', content: 'Thanks' }
      ]
    });

    expect(request.options.prompt).toEqual([
      { role: 'system', content: 'Be brief.' },
      { role: 'system', content: 'Use metric units.' },
      { role: 'user', content: [{ type: 'text', text: 'Weather in Vienna and Paris?' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'get_weather',
            input: { city: 'Vienna' }
          },
          {
            type: 'tool-call',
            toolCallId: 'call_2',
            toolName: 'get_weather',
            input: { city: 'Paris' }
          }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_1',
            toolName: 'get_weather',
            output: { type: 'text', value: '21°C' }
          },
          {
            type: 'tool-result',
            toolCallId: 'call_2',
            toolName: 'get_weather',
            output: { type: 'text', value: '18°C' }
          }
        ]
      },
      { role: 'assistant', content: [{ type: 'text', text: 'Vienna 21°C, Paris 18°C.' }] },
      { role: 'user', content: [{ type: 'text', text: 'Thanks' }] }
    ]);
  });

  it('maps images, audio and files', () => {
    let request = parse('openai_chat', {
      model: 'openai/gpt-test',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe these' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/cat.png', detail: 'high' }
            },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/AAAA' } },
            { type: 'input_audio', input_audio: { data: 'UklGRg==', format: 'wav' } },
            { type: 'input_audio', input_audio: { data: 'SUQz', format: 'mp3' } },
            {
              type: 'file',
              file: { file_data: 'data:application/pdf;base64,JVBERi0=', filename: 'a.pdf' }
            },
            { type: 'file', file: { file_data: 'JVBERi0=' } }
          ]
        }
      ]
    });

    expect(request.options.prompt[0]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Describe these' },
        {
          type: 'file',
          mediaType: 'image',
          data: { type: 'url', url: new URL('https://example.com/cat.png') },
          providerOptions: { openai: { imageDetail: 'high' } }
        },
        { type: 'file', mediaType: 'image/jpeg', data: { type: 'data', data: '/9j/AAAA' } },
        { type: 'file', mediaType: 'audio/wav', data: { type: 'data', data: 'UklGRg==' } },
        { type: 'file', mediaType: 'audio/mpeg', data: { type: 'data', data: 'SUQz' } },
        {
          type: 'file',
          mediaType: 'application/pdf',
          data: { type: 'data', data: 'JVBERi0=' },
          filename: 'a.pdf'
        },
        {
          type: 'file',
          mediaType: 'application/pdf',
          data: { type: 'data', data: 'JVBERi0=' }
        }
      ]
    });
  });

  it('accepts reasoning_content on assistant messages', () => {
    let request = parse('openai_chat', {
      model: 'deepseek/deepseek-reasoner',
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello', reasoning_content: 'Greeting back.' },
        { role: 'user', content: 'Again' }
      ]
    });

    expect(request.options.prompt[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'Greeting back.' },
        { type: 'text', text: 'Hello' }
      ]
    });
  });

  it('restores provider metadata from reasoning_details, native or enveloped', () => {
    let envelope = encodeProviderMetadata({ google: { thoughtSignature: 'g-sig' } })!;
    let request = parse('openai_chat', {
      model: 'anthropic/claude-test',
      messages: [
        { role: 'user', content: 'Hi' },
        {
          role: 'assistant',
          content: 'Hello',
          reasoning_content: 'ignored when details exist',
          reasoning_details: [
            { type: 'reasoning.text', text: 'Native', signature: 'anthropic-sig' },
            { type: 'reasoning.text', text: 'Enveloped', signature: envelope },
            { type: 'reasoning.encrypted', data: 'redacted-blob' },
            { type: 'reasoning.summary', summary: 'skipped' }
          ]
        },
        { role: 'user', content: 'Again' }
      ]
    });

    expect(request.options.prompt[1]!.content).toEqual([
      {
        type: 'reasoning',
        text: 'Native',
        providerOptions: { anthropic: { signature: 'anthropic-sig' } }
      },
      {
        type: 'reasoning',
        text: 'Enveloped',
        providerOptions: { google: { thoughtSignature: 'g-sig' } }
      },
      {
        type: 'reasoning',
        text: '',
        providerOptions: { anthropic: { redactedData: 'redacted-blob' } }
      },
      { type: 'text', text: 'Hello' }
    ]);
  });

  it('keeps tool call arguments that are not valid JSON as a string', () => {
    let request = parse('openai_chat', {
      model: 'openai/gpt-test',
      messages: [
        { role: 'user', content: 'Hi' },
        {
          role: 'assistant',
          tool_calls: [
            { id: 'c', type: 'function', function: { name: 'f', arguments: '{broken' } }
          ]
        },
        { role: 'tool', tool_call_id: 'c', content: 'ok' }
      ]
    });

    expect(request.options.prompt[1]!.content).toEqual([
      { type: 'tool-call', toolCallId: 'c', toolName: 'f', input: '{broken' }
    ]);
  });
});

describe('openai chat: parsing settings', () => {
  it('maps sampling, limits and output settings', () => {
    let request = parse('openai_chat', {
      ...base,
      max_tokens: 10,
      max_completion_tokens: 200,
      temperature: 0.4,
      top_p: 0.9,
      presence_penalty: 0.5,
      frequency_penalty: -0.5,
      seed: 42,
      stop: 'END',
      reasoning_effort: 'high',
      prompt_cache_key: 'conversation-1',
      verbosity: 'low',
      n: 1,
      logprobs: false,
      modalities: ['text'],
      stream: true,
      stream_options: { include_usage: true }
    });

    expect(request.stream).toBe(true);
    expect(request.streamUsage).toBe(true);
    expect(request.options).toMatchObject({
      maxOutputTokens: 200,
      temperature: 0.4,
      topP: 0.9,
      presencePenalty: 0.5,
      frequencyPenalty: -0.5,
      seed: 42,
      stopSequences: ['END'],
      reasoning: 'high',
      providerOptions: { openai: { promptCacheKey: 'conversation-1', textVerbosity: 'low' } }
    });
  });

  it('falls back to max_tokens and accepts stop arrays', () => {
    let request = parse('openai_chat', { ...base, max_tokens: 64, stop: ['a', 'b'] });

    expect(request.options.maxOutputTokens).toBe(64);
    expect(request.options.stopSequences).toEqual(['a', 'b']);
    expect(request.stream).toBe(false);
    expect(request.streamUsage).toBe(false);
  });

  it('maps every response_format', () => {
    expect(
      parse('openai_chat', { ...base, response_format: { type: 'text' } }).options
        .responseFormat
    ).toEqual({
      type: 'text'
    });
    expect(
      parse('openai_chat', { ...base, response_format: { type: 'json_object' } }).options
        .responseFormat
    ).toEqual({ type: 'json' });
    expect(
      parse('openai_chat', {
        ...base,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'person',
            description: 'A person',
            strict: true,
            schema: { type: 'object' }
          }
        }
      }).options.responseFormat
    ).toEqual({
      type: 'json',
      name: 'person',
      description: 'A person',
      schema: { type: 'object' }
    });
  });

  it('maps tools and every tool_choice', () => {
    let tools = [
      weatherTool,
      { type: 'function', function: { name: 'no_args', strict: true } }
    ];

    let request = parse('openai_chat', {
      ...base,
      tools,
      tool_choice: 'required',
      parallel_tool_calls: false
    });
    expect(request.options.tools).toEqual([
      {
        type: 'function',
        name: 'get_weather',
        description: 'Weather for a city',
        inputSchema: weatherTool.function.parameters
      },
      {
        type: 'function',
        name: 'no_args',
        inputSchema: { type: 'object', properties: {} },
        strict: true
      }
    ]);
    expect(request.options.toolChoice).toEqual({ type: 'required' });
    expect(request.options.providerOptions).toEqual({
      openai: { parallelToolCalls: false },
      anthropic: { disableParallelToolUse: true }
    });

    expect(
      parse('openai_chat', { ...base, tools, tool_choice: 'auto' }).options.toolChoice
    ).toEqual({ type: 'auto' });
    expect(
      parse('openai_chat', { ...base, tools, tool_choice: 'none' }).options.toolChoice
    ).toEqual({ type: 'none' });
    expect(
      parse('openai_chat', {
        ...base,
        tools,
        tool_choice: { type: 'function', function: { name: 'no_args' } }
      }).options.toolChoice
    ).toEqual({ type: 'tool', toolName: 'no_args' });
  });

  it('leaves unset settings undefined so provider defaults apply', () => {
    let request = parse('openai_chat', base);

    expect(request.options).toEqual({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      maxOutputTokens: undefined,
      temperature: undefined,
      topP: undefined,
      presencePenalty: undefined,
      frequencyPenalty: undefined,
      seed: undefined,
      stopSequences: undefined,
      responseFormat: undefined,
      tools: undefined,
      toolChoice: undefined,
      reasoning: undefined,
      providerOptions: undefined
    });
  });
});

describe('openai chat: rejections', () => {
  let cases: [string, Record<string, unknown>, string, string][] = [
    ['multiple choices', { n: 2 }, 'n', 'unsupported_parameter'],
    ['logprobs', { logprobs: true }, 'logprobs', 'unsupported_parameter'],
    ['top_logprobs', { top_logprobs: 3 }, 'top_logprobs', 'unsupported_parameter'],
    ['logit_bias', { logit_bias: { '50256': -100 } }, 'logit_bias', 'unsupported_parameter'],
    [
      'audio output',
      { audio: { voice: 'alloy', format: 'wav' } },
      'audio',
      'unsupported_parameter'
    ],
    [
      'audio modality',
      { modalities: ['text', 'audio'] },
      'modalities',
      'unsupported_parameter'
    ],
    [
      'predicted outputs',
      { prediction: { type: 'content', content: 'x' } },
      'prediction',
      'unsupported_parameter'
    ],
    [
      'hosted web search',
      { web_search_options: { search_context_size: 'low' } },
      'web_search_options',
      'unsupported_parameter'
    ],
    ['legacy functions', { functions: [{ name: 'f' }] }, 'functions', 'unsupported_parameter'],
    [
      'legacy function_call',
      { function_call: 'auto' },
      'function_call',
      'unsupported_parameter'
    ],
    [
      'custom tools',
      { tools: [{ type: 'custom', custom: { name: 'x' } }] },
      'tools[0].type',
      'unsupported_parameter'
    ],
    [
      'allowed_tools choice',
      { tools: [weatherTool], tool_choice: { type: 'allowed_tools' } },
      'tool_choice',
      'unsupported_parameter'
    ],
    [
      'an unknown forced tool',
      { tools: [weatherTool], tool_choice: { type: 'function', function: { name: 'nope' } } },
      'tool_choice.function.name',
      'invalid_request'
    ],
    [
      'duplicate tool names',
      { tools: [weatherTool, weatherTool] },
      'tools[1]',
      'invalid_request'
    ],
    [
      'an invalid tool name',
      { tools: [{ type: 'function', function: { name: 'has space' } }] },
      'tools[0].function.name',
      'invalid_request'
    ],
    ['a temperature above 2', { temperature: 2.5 }, 'temperature', 'invalid_request'],
    ['a fractional max_tokens', { max_tokens: 1.5 }, 'max_tokens', 'invalid_request'],
    [
      'a zero max_completion_tokens',
      { max_completion_tokens: 0 },
      'max_completion_tokens',
      'invalid_request'
    ],
    [
      'an unknown reasoning effort',
      { reasoning_effort: 'extreme' },
      'reasoning_effort',
      'invalid_request'
    ],
    [
      'an unknown response_format',
      { response_format: { type: 'yaml' } },
      'response_format.type',
      'invalid_request'
    ],
    ['a non-string stop', { stop: [1] }, 'stop[0]', 'invalid_request'],
    ['a missing model', { model: undefined }, 'model', 'invalid_request'],
    ['empty messages', { messages: [] }, 'messages', 'invalid_request'],
    [
      'an unknown role',
      { messages: [{ role: 'robot', content: 'x' }] },
      'messages[0].role',
      'invalid_request'
    ],
    [
      'legacy function messages',
      { messages: [{ role: 'function', name: 'f', content: 'x' }] },
      'messages[0].role',
      'unsupported_parameter'
    ],
    [
      'an unknown content part',
      { messages: [{ role: 'user', content: [{ type: 'video' }] }] },
      'messages[0].content[0].type',
      'invalid_request'
    ],
    [
      'a non-http image url',
      {
        messages: [
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'ftp://x/y.png' } }]
          }
        ]
      },
      'messages[0].content[0].image_url.url',
      'invalid_request'
    ],
    [
      'an unknown audio format',
      {
        messages: [
          {
            role: 'user',
            content: [{ type: 'input_audio', input_audio: { data: 'x', format: 'ogg' } }]
          }
        ]
      },
      'messages[0].content[0].input_audio.format',
      'invalid_request'
    ],
    [
      'uploaded file ids',
      {
        messages: [{ role: 'user', content: [{ type: 'file', file: { file_id: 'file-1' } }] }]
      },
      'messages[0].content[0].file.file_id',
      'unsupported_parameter'
    ],
    [
      'a tool result without a matching call',
      {
        messages: [
          { role: 'user', content: 'x' },
          { role: 'tool', tool_call_id: 'missing', content: 'r' }
        ]
      },
      'messages[1].tool_call_id',
      'invalid_request'
    ]
  ];

  it.each(cases)('rejects %s', (_name, patch, param, code) => {
    let error = parseError('openai_chat', { ...base, ...patch });

    expect(error).toMatchObject({ status: 400, param, code });
    expect(error.message.length).toBeGreaterThan(10);
  });

  it('surfaces rejections through the OpenAI SDK as a 400 with the param', async () => {
    let client = openaiClient(gatewayFetch('openai_chat', () => ({ steps: [] })).fetch);
    let error = await client.chat.completions
      .create({ ...(base as any), n: 3 })
      .catch(error => error);

    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(400);
    expect(error.param).toBe('n');
    expect(error.code).toBe('unsupported_parameter');
    expect(error.type).toBe('invalid_request_error');
  });
});

describe('openai chat: responses', () => {
  it('builds the exact chat.completion object', async () => {
    let run = await runDialect({
      dialect: 'openai_chat',
      body: base,
      script: {
        steps: [{ type: 'text', text: 'Hello!' }],
        usage: { input: 10, output: 5, cacheRead: 4, reasoning: 2 }
      }
    });

    expect(run.response).toEqual({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 1_700_000_000,
      model: 'gateway/test-model',
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello!', refusal: null },
          logprobs: null,
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 14,
        completion_tokens: 5,
        total_tokens: 19,
        prompt_tokens_details: { cached_tokens: 4 },
        completion_tokens_details: { reasoning_tokens: 2 }
      }
    });
  });

  it('returns null content for a tool-only turn', async () => {
    let run = await runDialect({
      dialect: 'openai_chat',
      body: { ...base, tools: [weatherTool] },
      script: {
        steps: [
          { type: 'tool-call', id: 'call_1', name: 'get_weather', input: { city: 'Rome' } }
        ]
      }
    });

    expect(run.response.choices[0]).toEqual({
      index: 0,
      message: {
        role: 'assistant',
        content: null,
        refusal: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city":"Rome"}' }
          }
        ]
      },
      logprobs: null,
      finish_reason: 'tool_calls'
    });
  });

  it('returns reasoning text and an enveloped signature that round-trips', async () => {
    let metadata = { anthropic: { signature: 'anthropic-sig' } };
    let run = await runDialect({
      dialect: 'openai_chat',
      body: base,
      script: {
        steps: [
          { type: 'reasoning', text: 'Thinking.', metadata },
          { type: 'text', text: 'Done.' }
        ]
      }
    });

    let message = run.response.choices[0].message;
    expect(message.reasoning_content).toBe('Thinking.');
    expect(message.reasoning_details).toEqual([
      {
        type: 'reasoning.text',
        text: 'Thinking.',
        signature: encodeProviderMetadata(metadata)
      }
    ]);

    let next = parse('openai_chat', {
      ...base,
      messages: [...base.messages, message, { role: 'user', content: 'More' }]
    });
    expect(next.options.prompt[1]!.content[0]).toEqual({
      type: 'reasoning',
      text: 'Thinking.',
      providerOptions: metadata
    });
  });

  it('returns redacted reasoning as an encrypted detail that round-trips', async () => {
    let metadata = { anthropic: { redactedData: 'opaque' } };
    let run = await runDialect({
      dialect: 'openai_chat',
      body: base,
      script: {
        steps: [
          {
            type: 'reasoning',
            text: '',
            redacted: 'opaque',
            metadata,
            startMetadata: metadata
          }
        ]
      }
    });

    let message = run.response.choices[0].message;
    expect(message.reasoning_details).toEqual([
      { type: 'reasoning.encrypted', data: encodeProviderMetadata(metadata) }
    ]);
    expect(decodeProviderMetadata(message.reasoning_details[0].data)).toEqual(metadata);
  });
});

describe('openai chat: streaming', () => {
  let chunk = (delta: unknown, finish: string | null = null) => ({
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: 1_700_000_000,
    model: 'gateway/test-model',
    system_fingerprint: null,
    choices: [{ index: 0, delta, logprobs: null, finish_reason: finish }]
  });

  it('streams the exact chunk sequence for text', async () => {
    let run = await runDialect({
      dialect: 'openai_chat',
      body: { ...base, stream: true },
      script: { chunkSize: 3, steps: [{ type: 'text', text: 'Hello' }] }
    });

    expect(run.events!.map(event => event.event)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    ]);
    expect(run.events!.map(event => event.json ?? event.data)).toEqual([
      chunk({ role: 'assistant', content: '', refusal: null }),
      chunk({ content: 'Hel' }),
      chunk({ content: 'lo' }),
      chunk({}, 'stop'),
      '[DONE]'
    ]);
  });

  it('only sends a usage chunk when include_usage is set', async () => {
    let script = {
      steps: [{ type: 'text' as const, text: 'Hi' }],
      usage: { input: 3, output: 1 }
    };
    let without = await runDialect({
      dialect: 'openai_chat',
      body: { ...base, stream: true },
      script
    });
    let withUsage = await runDialect({
      dialect: 'openai_chat',
      body: { ...base, stream: true, stream_options: { include_usage: true } },
      script
    });

    expect(without.events!.some(event => event.json?.usage)).toBe(false);
    expect(withUsage.events!.at(-2)!.json).toEqual({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: 1_700_000_000,
      model: 'gateway/test-model',
      system_fingerprint: null,
      choices: [],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 1,
        total_tokens: 4,
        prompt_tokens_details: { cached_tokens: 0 },
        completion_tokens_details: { reasoning_tokens: 0 }
      }
    });
    expect(withUsage.events!.at(-1)!.data).toBe('[DONE]');
  });

  it('streams tool calls with stable indexes, the id and name only in the first delta', async () => {
    let run = await runDialect({
      dialect: 'openai_chat',
      body: { ...base, stream: true, tools: [weatherTool] },
      script: {
        chunkSize: 8,
        steps: [
          { type: 'tool-call', id: 'call_a', name: 'get_weather', input: { city: 'Vienna' } },
          {
            type: 'tool-call',
            id: 'call_b',
            name: 'get_weather',
            input: { city: 'Rome' },
            streamInput: false
          }
        ]
      }
    });

    let deltas = run.events!.flatMap(event =>
      event.json ? [event.json.choices[0]?.delta] : []
    );
    expect(deltas).toEqual([
      { role: 'assistant', content: '', refusal: null },
      {
        tool_calls: [
          {
            index: 0,
            id: 'call_a',
            type: 'function',
            function: { name: 'get_weather', arguments: '' }
          }
        ]
      },
      { tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] },
      { tool_calls: [{ index: 0, function: { arguments: '"Vienna"' } }] },
      { tool_calls: [{ index: 0, function: { arguments: '}' } }] },
      {
        tool_calls: [
          {
            index: 1,
            id: 'call_b',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city":"Rome"}' }
          }
        ]
      },
      {}
    ]);
    expect(run.events!.at(-2)!.json.choices[0].finish_reason).toBe('tool_calls');
  });

  it('streams reasoning deltas and one reasoning detail per block', async () => {
    let metadata = { anthropic: { signature: 'sig' } };
    let run = await runDialect({
      dialect: 'openai_chat',
      body: { ...base, stream: true },
      script: {
        chunkSize: 5,
        steps: [
          { type: 'reasoning', text: 'Think hard', metadata },
          { type: 'text', text: 'Ok' }
        ]
      }
    });

    let deltas = run.events!.flatMap(event =>
      event.json ? [event.json.choices[0]?.delta] : []
    );
    expect(deltas).toEqual([
      { role: 'assistant', content: '', refusal: null },
      { reasoning_content: 'Think' },
      { reasoning_content: ' hard' },
      {
        reasoning_details: [
          {
            type: 'reasoning.text',
            text: 'Think hard',
            signature: encodeProviderMetadata(metadata)
          }
        ]
      },
      { content: 'Ok' },
      {}
    ]);
  });

  it('starts the stream even when the model produced nothing', async () => {
    let run = await runDialect({
      dialect: 'openai_chat',
      body: { ...base, stream: true },
      script: { steps: [] }
    });

    expect(run.events!.map(event => event.json?.choices[0]?.delta ?? event.data)).toEqual([
      { role: 'assistant', content: '', refusal: null },
      {},
      '[DONE]'
    ]);
  });

  it('ends a failed stream with an error chunk and no [DONE]', async () => {
    let run = await runDialect({
      dialect: 'openai_chat',
      body: { ...base, stream: true },
      script: {
        steps: [{ type: 'text', text: 'Partial' }],
        failMidStream: { message: 'boom' }
      }
    });

    expect(run.events!.at(-1)!.json).toEqual({
      error: {
        message: 'The upstream provider failed mid-stream.',
        type: 'api_error',
        param: null,
        code: 'upstream_error'
      }
    });
    expect(run.events!.some(event => event.data == '[DONE]')).toBe(false);
  });

  it('makes the OpenAI SDK throw on a failed stream', async () => {
    let client = openaiClient(
      gatewayFetch('openai_chat', () => ({
        steps: [{ type: 'text', text: 'Partial' }],
        failMidStream: { message: 'boom' }
      })).fetch
    );

    let received = '';
    let error = await (async () => {
      let stream = await client.chat.completions.create({
        model: base.model,
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true
      });
      for await (let chunk of stream) received += chunk.choices[0]?.delta?.content ?? '';
    })().catch(error => error);

    expect(received).toBe('Partial');
    expect(error).toBeInstanceOf(APIError);
    expect(error.message).toContain('The upstream provider failed mid-stream.');
  });
});
