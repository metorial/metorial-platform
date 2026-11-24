import { APIError } from 'openai';
import { describe, expect, it } from 'vitest';
import { encodeProviderMetadata } from '../src';
import { gatewayFetch, openaiClient, parse, parseError, runDialect } from './harness';

let base = { model: 'openai/gpt-test', input: 'Hi' };

let weatherTool = {
  type: 'function',
  name: 'get_weather',
  description: 'Weather for a city',
  parameters: { type: 'object', properties: { city: { type: 'string' } } },
  strict: true
};

let openaiReasoning = (itemId: string, encrypted: string | null) => ({
  startMetadata: { openai: { itemId, reasoningEncryptedContent: null } },
  metadata: {
    openai: { itemId, ...(encrypted ? { reasoningEncryptedContent: encrypted } : {}) }
  }
});

describe('open responses: parsing input', () => {
  it('maps a string input with instructions', () => {
    let request = parse('open_responses', { ...base, instructions: 'Be brief.' });

    expect(request.options.prompt).toEqual([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: [{ type: 'text', text: 'Hi' }] }
    ]);
  });

  it('maps message items of every role and content type', () => {
    let request = parse('open_responses', {
      ...base,
      input: [
        { role: 'system', content: 'System text' },
        {
          type: 'message',
          role: 'developer',
          content: [{ type: 'input_text', text: 'Developer text' }]
        },
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: 'Look' },
            { type: 'input_image', image_url: 'https://example.com/a.png', detail: 'low' },
            { type: 'input_image', image_url: 'data:image/png;base64,iVBO' },
            {
              type: 'input_file',
              file_data: 'data:application/pdf;base64,JVBE',
              filename: 'x.pdf'
            },
            { type: 'input_file', file_url: 'https://example.com/y.pdf' }
          ]
        },
        {
          type: 'message',
          role: 'assistant',
          id: 'msg_1',
          status: 'completed',
          content: [
            { type: 'output_text', text: 'Seen', annotations: [] },
            { type: 'refusal', refusal: ' but no.' }
          ]
        }
      ]
    });

    expect(request.options.prompt).toEqual([
      { role: 'system', content: 'System text' },
      { role: 'system', content: 'Developer text' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Look' },
          {
            type: 'file',
            mediaType: 'image',
            data: { type: 'url', url: new URL('https://example.com/a.png') },
            providerOptions: { openai: { imageDetail: 'low' } }
          },
          { type: 'file', mediaType: 'image/png', data: { type: 'data', data: 'iVBO' } },
          {
            type: 'file',
            mediaType: 'application/pdf',
            data: { type: 'data', data: 'JVBE' },
            filename: 'x.pdf'
          },
          {
            type: 'file',
            mediaType: 'application/pdf',
            data: { type: 'url', url: new URL('https://example.com/y.pdf') }
          }
        ]
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Seen' },
          { type: 'text', text: ' but no.' }
        ]
      }
    ]);
  });

  it('merges consecutive output items into one assistant turn and pairs tool outputs', () => {
    let request = parse('open_responses', {
      ...base,
      input: [
        { role: 'user', content: 'Weather in two cities?' },
        {
          type: 'reasoning',
          id: 'rs_1',
          summary: [{ type: 'summary_text', text: 'Two calls.' }],
          encrypted_content: 'enc-1'
        },
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'get_weather',
          arguments: '{"city":"Vienna"}'
        },
        {
          type: 'function_call',
          call_id: 'call_2',
          name: 'get_weather',
          arguments: '{"city":"Oslo"}'
        },
        { type: 'function_call_output', call_id: 'call_1', output: '21°C' },
        {
          type: 'function_call_output',
          call_id: 'call_2',
          output: [{ type: 'input_text', text: '5°C' }]
        },
        { role: 'assistant', content: 'Vienna 21°C, Oslo 5°C.' }
      ]
    });

    expect(request.options.prompt).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Weather in two cities?' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Two calls.',
            providerOptions: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc-1' } }
          },
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
            input: { city: 'Oslo' }
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
            output: { type: 'text', value: '5°C' }
          }
        ]
      },
      { role: 'assistant', content: [{ type: 'text', text: 'Vienna 21°C, Oslo 5°C.' }] }
    ]);
  });

  it('maps tool outputs with images to content output', () => {
    let request = parse('open_responses', {
      ...base,
      input: [
        { role: 'user', content: 'Screenshot' },
        { type: 'function_call', call_id: 'c', name: 'shot', arguments: '{}' },
        {
          type: 'function_call_output',
          call_id: 'c',
          output: [
            { type: 'input_text', text: 'Here' },
            { type: 'input_image', image_url: 'data:image/png;base64,iVBO' }
          ]
        }
      ]
    });

    expect(request.options.prompt[2]!.content[0]).toEqual({
      type: 'tool-result',
      toolCallId: 'c',
      toolName: 'shot',
      output: {
        type: 'content',
        value: [
          { type: 'text', text: 'Here' },
          { type: 'file', data: { type: 'data', data: 'iVBO' }, mediaType: 'image/png' }
        ]
      }
    });
  });

  it('expands native OpenAI reasoning into one part per summary and decodes enveloped reasoning', () => {
    let envelope = encodeProviderMetadata({ anthropic: { signature: 'sig' } })!;
    let request = parse('open_responses', {
      ...base,
      input: [
        { role: 'user', content: 'Hi' },
        {
          type: 'reasoning',
          id: 'rs_9',
          summary: [
            { type: 'summary_text', text: 'First.' },
            { type: 'summary_text', text: 'Second.' }
          ],
          encrypted_content: 'enc-9'
        },
        {
          type: 'reasoning',
          id: 'rs_x',
          summary: [],
          content: [{ type: 'reasoning_text', text: 'Claude thought' }],
          encrypted_content: envelope
        },
        {
          type: 'reasoning',
          summary: [],
          content: [{ type: 'reasoning_text', text: 'Open weights' }]
        },
        { role: 'assistant', content: 'Hello' }
      ]
    });

    let native = { openai: { itemId: 'rs_9', reasoningEncryptedContent: 'enc-9' } };
    expect(request.options.prompt[1]!.content).toEqual([
      { type: 'reasoning', text: 'First.', providerOptions: native },
      { type: 'reasoning', text: 'Second.', providerOptions: native },
      {
        type: 'reasoning',
        text: 'Claude thought',
        providerOptions: { anthropic: { signature: 'sig' } }
      },
      { type: 'reasoning', text: 'Open weights' },
      { type: 'text', text: 'Hello' }
    ]);
  });
});

describe('open responses: parsing settings', () => {
  it('maps sampling, reasoning, text and tool settings', () => {
    let request = parse('open_responses', {
      ...base,
      max_output_tokens: 300,
      temperature: 0.3,
      top_p: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.2,
      reasoning: { effort: 'low', summary: 'detailed' },
      text: {
        verbosity: 'high',
        format: {
          type: 'json_schema',
          name: 'out',
          description: 'Output',
          schema: { type: 'object' },
          strict: true
        }
      },
      tools: [weatherTool],
      tool_choice: { type: 'function', name: 'get_weather' },
      parallel_tool_calls: false,
      prompt_cache_key: 'k',
      safety_identifier: 'user-hash',
      user: 'legacy-user',
      store: false,
      include: ['reasoning.encrypted_content'],
      truncation: 'disabled',
      service_tier: 'auto',
      stream: true
    });

    expect(request.stream).toBe(true);
    expect(request.options).toMatchObject({
      maxOutputTokens: 300,
      temperature: 0.3,
      topP: 0.7,
      presencePenalty: 0.1,
      frequencyPenalty: 0.2,
      reasoning: 'low',
      responseFormat: {
        type: 'json',
        name: 'out',
        description: 'Output',
        schema: { type: 'object' }
      },
      toolChoice: { type: 'tool', toolName: 'get_weather' },
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Weather for a city',
          inputSchema: weatherTool.parameters,
          strict: true
        }
      ]
    });
    expect(request.options.providerOptions).toEqual({
      openai: {
        parallelToolCalls: false,
        reasoningSummary: 'detailed',
        strictJsonSchema: true,
        textVerbosity: 'high',
        promptCacheKey: 'k',
        safetyIdentifier: 'user-hash',
        user: 'legacy-user'
      },
      anthropic: { disableParallelToolUse: true }
    });
  });

  it('maps json_object and text formats and string tool choices', () => {
    expect(
      parse('open_responses', { ...base, text: { format: { type: 'json_object' } } }).options
        .responseFormat
    ).toEqual({
      type: 'json'
    });
    expect(
      parse('open_responses', { ...base, text: { format: { type: 'text' } } }).options
        .responseFormat
    ).toEqual({
      type: 'text'
    });
    expect(
      parse('open_responses', { ...base, tools: [weatherTool], tool_choice: 'required' })
        .options.toolChoice
    ).toEqual({
      type: 'required'
    });
  });
});

describe('open responses: rejections', () => {
  let cases: [string, Record<string, unknown>, string, string][] = [
    [
      'previous_response_id',
      { previous_response_id: 'resp_1' },
      'previous_response_id',
      'unsupported_parameter'
    ],
    ['conversations', { conversation: 'conv_1' }, 'conversation', 'unsupported_parameter'],
    ['background mode', { background: true }, 'background', 'unsupported_parameter'],
    ['stored prompts', { prompt: { id: 'pmpt_1' } }, 'prompt', 'unsupported_parameter'],
    ['max_tool_calls', { max_tool_calls: 3 }, 'max_tool_calls', 'unsupported_parameter'],
    ['top_logprobs', { top_logprobs: 2 }, 'top_logprobs', 'unsupported_parameter'],
    ['store: true', { store: true }, 'store', 'unsupported_parameter'],
    ['automatic truncation', { truncation: 'auto' }, 'truncation', 'unsupported_parameter'],
    ['other service tiers', { service_tier: 'flex' }, 'service_tier', 'invalid_request'],
    [
      'unsupported includes',
      { include: ['reasoning.encrypted_content', 'message.output_text.logprobs'] },
      'include[1]',
      'unsupported_parameter'
    ],
    [
      'hosted tools',
      { tools: [{ type: 'web_search' }] },
      'tools[0].type',
      'unsupported_parameter'
    ],
    [
      'allowed_tools choices',
      {
        tools: [weatherTool],
        tool_choice: { type: 'allowed_tools', mode: 'auto', tools: [] }
      },
      'tool_choice.type',
      'unsupported_parameter'
    ],
    [
      'an unknown forced tool',
      { tools: [weatherTool], tool_choice: { type: 'function', name: 'x' } },
      'tool_choice.name',
      'invalid_request'
    ],
    [
      'item references',
      { input: [{ type: 'item_reference', id: 'msg_1' }] },
      'input[0].type',
      'unsupported_parameter'
    ],
    [
      'hosted tool call items',
      {
        input: [
          { role: 'user', content: 'x' },
          { type: 'web_search_call', id: 'ws' }
        ]
      },
      'input[1].type',
      'unsupported_parameter'
    ],
    [
      'an unknown role',
      { input: [{ role: 'tool', content: 'x' }] },
      'input[0].role',
      'invalid_request'
    ],
    [
      'an unknown content type',
      { input: [{ role: 'user', content: [{ type: 'input_video' }] }] },
      'input[0].content[0].type',
      'invalid_request'
    ],
    [
      'images in system messages',
      {
        input: [
          { role: 'system', content: [{ type: 'input_image', image_url: 'https://x/y.png' }] }
        ]
      },
      'input[0].content[0]',
      'invalid_request'
    ],
    [
      'file ids',
      { input: [{ role: 'user', content: [{ type: 'input_file', file_id: 'file-1' }] }] },
      'input[0].content[0].file_id',
      'unsupported_parameter'
    ],
    ['empty input', { input: [] }, 'input', 'invalid_request'],
    [
      'an unknown reasoning effort',
      { reasoning: { effort: 'huge' } },
      'reasoning.effort',
      'invalid_request'
    ],
    [
      'an output without a call',
      { input: [{ type: 'function_call_output', call_id: 'nope', output: 'x' }] },
      'input[0].call_id',
      'invalid_request'
    ]
  ];

  it.each(cases)('rejects %s', (_name, patch, param, code) => {
    expect(parseError('open_responses', { ...base, ...patch })).toMatchObject({
      status: 400,
      param,
      code
    });
  });

  it('surfaces rejections through the OpenAI SDK', async () => {
    let client = openaiClient(gatewayFetch('open_responses', () => ({ steps: [] })).fetch);
    let error = await client.responses
      .create({ ...base, previous_response_id: 'resp_1' })
      .catch(error => error);

    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(400);
    expect(error.param).toBe('previous_response_id');
  });
});

describe('open responses: responses', () => {
  it('builds the response object and echoes request settings', async () => {
    let run = await runDialect({
      dialect: 'open_responses',
      body: {
        ...base,
        instructions: 'Be brief.',
        temperature: 0.5,
        metadata: { ticket: '42' },
        tools: [weatherTool],
        reasoning: { effort: 'low' }
      },
      script: {
        steps: [{ type: 'text', text: 'Hello!' }],
        usage: { input: 10, output: 5, cacheRead: 2, reasoning: 1 }
      }
    });

    expect(run.response).toMatchObject({
      id: 'resp_test',
      object: 'response',
      created_at: 1_700_000_000,
      status: 'completed',
      incomplete_details: null,
      error: null,
      model: 'gateway/test-model',
      output: [
        {
          type: 'message',
          id: 'msg_test_0',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hello!', annotations: [], logprobs: [] }]
        }
      ],
      usage: {
        input_tokens: 12,
        input_tokens_details: { cached_tokens: 2 },
        output_tokens: 5,
        output_tokens_details: { reasoning_tokens: 1 },
        total_tokens: 17
      },
      instructions: 'Be brief.',
      temperature: 0.5,
      metadata: { ticket: '42' },
      tools: [weatherTool],
      reasoning: { effort: 'low' },
      store: false,
      background: false,
      previous_response_id: null
    });
    expect(typeof run.response.completed_at).toBe('number');
  });

  it('groups OpenAI summary parts into one reasoning item with native encrypted content', async () => {
    let run = await runDialect({
      dialect: 'open_responses',
      body: base,
      script: {
        steps: [
          {
            type: 'reasoning',
            id: 'rs_abc:0',
            text: 'First.',
            ...openaiReasoning('rs_abc', null)
          },
          {
            type: 'reasoning',
            id: 'rs_abc:1',
            text: 'Second.',
            ...openaiReasoning('rs_abc', 'enc-abc')
          },
          { type: 'text', text: 'Answer' }
        ]
      }
    });

    expect(run.response.output[0]).toEqual({
      type: 'reasoning',
      id: 'rs_abc',
      summary: [
        { type: 'summary_text', text: 'First.' },
        { type: 'summary_text', text: 'Second.' }
      ],
      encrypted_content: 'enc-abc'
    });
  });

  it('returns other reasoning as reasoning_text with enveloped metadata that round-trips', async () => {
    let metadata = { anthropic: { signature: 'sig' } };
    let run = await runDialect({
      dialect: 'open_responses',
      body: base,
      script: {
        steps: [
          { type: 'reasoning', text: 'Claude thinks', metadata },
          { type: 'text', text: 'Hi' }
        ]
      }
    });

    expect(run.response.output[0]).toEqual({
      type: 'reasoning',
      id: 'rs_test_0',
      summary: [],
      content: [{ type: 'reasoning_text', text: 'Claude thinks' }],
      encrypted_content: encodeProviderMetadata(metadata)
    });

    let next = parse('open_responses', {
      ...base,
      input: [
        { role: 'user', content: 'Hi' },
        ...run.response.output,
        { role: 'user', content: 'More' }
      ]
    });
    expect(next.options.prompt[1]!.content).toEqual([
      { type: 'reasoning', text: 'Claude thinks', providerOptions: metadata },
      { type: 'text', text: 'Hi' }
    ]);
  });

  it('round-trips native OpenAI reasoning and function calls back into the same prompt', async () => {
    let run = await runDialect({
      dialect: 'open_responses',
      body: { ...base, tools: [weatherTool] },
      script: {
        steps: [
          {
            type: 'reasoning',
            id: 'rs_1:0',
            text: 'Need weather.',
            ...openaiReasoning('rs_1', 'enc-1')
          },
          { type: 'tool-call', id: 'call_1', name: 'get_weather', input: { city: 'Vienna' } }
        ]
      }
    });

    let next = parse('open_responses', {
      ...base,
      input: [
        { role: 'user', content: 'Hi' },
        ...run.response.output,
        { type: 'function_call_output', call_id: 'call_1', output: '21°C' }
      ]
    });

    expect(next.options.prompt.slice(1)).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Need weather.',
            providerOptions: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc-1' } }
          },
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'get_weather',
            input: { city: 'Vienna' }
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
          }
        ]
      }
    ]);
  });

  it.each([
    ['length', 'max_output_tokens'],
    ['content-filter', 'content_filter']
  ] as const)('reports a %s finish as incomplete', async (finish, reason) => {
    let run = await runDialect({
      dialect: 'open_responses',
      body: base,
      script: { finish, steps: [{ type: 'text', text: 'Cut' }] }
    });

    expect(run.response.status).toBe('incomplete');
    expect(run.response.incomplete_details).toEqual({ reason });
    expect(run.response.output[0].status).toBe('incomplete');
  });
});

describe('open responses: streaming', () => {
  it('streams the exact event sequence for text with increasing sequence numbers', async () => {
    let run = await runDialect({
      dialect: 'open_responses',
      body: { ...base, stream: true },
      script: { chunkSize: 3, steps: [{ type: 'text', text: 'Hello' }] }
    });

    let events = run.events!;
    expect(events.map(event => event.event)).toEqual([
      'response.created',
      'response.in_progress',
      'response.output_item.added',
      'response.content_part.added',
      'response.output_text.delta',
      'response.output_text.delta',
      'response.output_text.done',
      'response.content_part.done',
      'response.output_item.done',
      'response.completed'
    ]);
    events.forEach((event, position) => {
      expect(event.json.type).toBe(event.event);
      expect(event.json.sequence_number).toBe(position);
    });

    expect(events[0]!.json.response).toMatchObject({
      id: 'resp_test',
      status: 'in_progress',
      output: [],
      usage: null
    });
    expect(events[2]!.json).toMatchObject({
      output_index: 0,
      item: {
        type: 'message',
        id: 'msg_test_0',
        status: 'in_progress',
        role: 'assistant',
        content: []
      }
    });
    expect(events[4]!.json).toMatchObject({
      item_id: 'msg_test_0',
      output_index: 0,
      content_index: 0,
      delta: 'Hel'
    });
    expect(events[6]!.json).toMatchObject({ text: 'Hello' });
    expect(events[9]!.json.response).toMatchObject({
      status: 'completed',
      output: [
        {
          type: 'message',
          id: 'msg_test_0',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Hello' }]
        }
      ]
    });
  });

  it('streams OpenAI reasoning as summary parts within one item', async () => {
    let run = await runDialect({
      dialect: 'open_responses',
      body: { ...base, stream: true },
      script: {
        steps: [
          {
            type: 'reasoning',
            id: 'rs_abc:0',
            text: 'One',
            ...openaiReasoning('rs_abc', null)
          },
          {
            type: 'reasoning',
            id: 'rs_abc:1',
            text: 'Two',
            ...openaiReasoning('rs_abc', 'enc')
          },
          { type: 'text', text: 'Hi' }
        ]
      }
    });

    let events = run.events!;
    expect(events.slice(2, 13).map(event => event.event)).toEqual([
      'response.output_item.added',
      'response.reasoning_summary_part.added',
      'response.reasoning_summary_text.delta',
      'response.reasoning_summary_text.done',
      'response.reasoning_summary_part.done',
      'response.reasoning_summary_part.added',
      'response.reasoning_summary_text.delta',
      'response.reasoning_summary_text.done',
      'response.reasoning_summary_part.done',
      'response.output_item.done',
      'response.output_item.added'
    ]);
    expect(events[7]!.json).toMatchObject({ item_id: 'rs_abc', summary_index: 1 });
    expect(events[11]!.json.item).toEqual({
      type: 'reasoning',
      id: 'rs_abc',
      summary: [
        { type: 'summary_text', text: 'One' },
        { type: 'summary_text', text: 'Two' }
      ],
      encrypted_content: 'enc'
    });
    expect(events[12]!.json.output_index).toBe(1);
  });

  it('streams other reasoning as reasoning_text content', async () => {
    let run = await runDialect({
      dialect: 'open_responses',
      body: { ...base, stream: true },
      script: {
        steps: [
          { type: 'reasoning', text: 'Raw', metadata: { anthropic: { signature: 's' } } }
        ]
      }
    });

    expect(run.events!.slice(2, 8).map(event => event.event)).toEqual([
      'response.output_item.added',
      'response.content_part.added',
      'response.reasoning_text.delta',
      'response.reasoning_text.done',
      'response.content_part.done',
      'response.output_item.done'
    ]);
    expect(run.events![7]!.json.item.encrypted_content).toBe(
      encodeProviderMetadata({ anthropic: { signature: 's' } })
    );
  });

  it('streams function calls with argument deltas', async () => {
    let run = await runDialect({
      dialect: 'open_responses',
      body: { ...base, stream: true, tools: [weatherTool] },
      script: {
        chunkSize: 10,
        steps: [
          { type: 'tool-call', id: 'call_1', name: 'get_weather', input: { city: 'Vienna' } },
          {
            type: 'tool-call',
            id: 'call_2',
            name: 'get_weather',
            input: { city: 'Rome' },
            streamInput: false
          }
        ]
      }
    });

    let events = run.events!;
    expect(events.slice(2, -1).map(event => event.event)).toEqual([
      'response.output_item.added',
      'response.function_call_arguments.delta',
      'response.function_call_arguments.delta',
      'response.function_call_arguments.done',
      'response.output_item.done',
      'response.output_item.added',
      'response.function_call_arguments.delta',
      'response.function_call_arguments.done',
      'response.output_item.done'
    ]);
    expect(events[2]!.json.item).toEqual({
      type: 'function_call',
      id: 'fc_test_0',
      call_id: 'call_1',
      name: 'get_weather',
      arguments: '',
      status: 'in_progress'
    });
    expect(events[5]!.json).toMatchObject({
      item_id: 'fc_test_0',
      name: 'get_weather',
      arguments: '{"city":"Vienna"}'
    });
    expect(events[7]!.json.output_index).toBe(1);
    expect(events.at(-1)!.event).toBe('response.completed');
  });

  it('ends with response.incomplete when the output was cut', async () => {
    let run = await runDialect({
      dialect: 'open_responses',
      body: { ...base, stream: true },
      script: { finish: 'length', steps: [{ type: 'text', text: 'Cut' }] }
    });

    let last = run.events!.at(-1)!;
    expect(last.event).toBe('response.incomplete');
    expect(last.json.response).toMatchObject({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [{ type: 'message', status: 'incomplete' }]
    });
  });

  it('emits error then response.failed on failure, which makes the SDK throw', async () => {
    let script = {
      steps: [{ type: 'text' as const, text: 'Partial' }],
      failMidStream: { message: 'boom' }
    };
    let run = await runDialect({
      dialect: 'open_responses',
      body: { ...base, stream: true },
      script
    });

    expect(run.events!.slice(-2).map(event => event.json)).toEqual([
      {
        type: 'error',
        sequence_number: run.events!.length - 2,
        code: 'upstream_error',
        message: 'The upstream provider failed mid-stream.',
        param: null
      },
      expect.objectContaining({
        type: 'response.failed',
        response: expect.objectContaining({
          status: 'failed',
          error: {
            code: 'upstream_error',
            message: 'The upstream provider failed mid-stream.'
          }
        })
      })
    ]);

    let error = await openaiClient(gatewayFetch('open_responses', () => script).fetch)
      .responses.stream(base)
      .finalResponse()
      .catch(error => error);
    expect(error).toBeInstanceOf(APIError);
  });
});
