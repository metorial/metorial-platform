import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { createFakeUpstream, type Script } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import {
  createProviderLanguageModel,
  getProviderDefinition,
  prepareProviderCallOptions,
  providerDefinitions,
  providerKindOf
} from '../src';

type ProviderCase = {
  slug: string;
  config?: Record<string, string>;
  url: RegExp;
  auth: (headers: Record<string, string>) => boolean;
  modelInBody?: boolean;
};

let apiKey = 'sk-test-secret-1234';

let bearer = (headers: Record<string, string>) => headers.authorization == `Bearer ${apiKey}`;

let providerCases: ProviderCase[] = [
  { slug: 'openai', url: /^https:\/\/api\.openai\.com\/v1\/responses$/, auth: bearer },
  {
    slug: 'anthropic',
    url: /^https:\/\/api\.anthropic\.com\/v1\/messages$/,
    auth: headers => headers['x-api-key'] == apiKey
  },
  {
    slug: 'google-ai-studio',
    url: /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/test-model:streamGenerateContent\?alt=sse$/,
    auth: headers => headers['x-goog-api-key'] == apiKey,
    modelInBody: false
  },
  {
    slug: 'azure',
    config: { resourceName: 'acme-ai' },
    url: /^https:\/\/acme-ai\.openai\.azure\.com\/openai\/v1\/responses\?api-version=v1$/,
    auth: headers => headers['api-key'] == apiKey
  },
  { slug: 'xai', url: /^https:\/\/api\.x\.ai\/v1\/responses$/, auth: bearer },
  {
    slug: 'mistral',
    url: /^https:\/\/api\.mistral\.ai\/v1\/chat\/completions$/,
    auth: bearer
  },
  {
    slug: 'groq',
    url: /^https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions$/,
    auth: bearer
  },
  {
    slug: 'deepseek',
    url: /^https:\/\/api\.deepseek\.com\/(v1\/)?chat\/completions$/,
    auth: bearer
  },
  {
    slug: 'cerebras',
    url: /^https:\/\/api\.cerebras\.ai\/v1\/chat\/completions$/,
    auth: bearer
  },
  {
    slug: 'together',
    url: /^https:\/\/api\.together\.xyz\/v1\/chat\/completions$/,
    auth: bearer
  },
  {
    slug: 'fireworks',
    url: /^https:\/\/api\.fireworks\.ai\/inference\/v1\/chat\/completions$/,
    auth: bearer
  },
  {
    slug: 'deepinfra',
    url: /^https:\/\/api\.deepinfra\.com\/v1\/openai\/chat\/completions$/,
    auth: bearer
  },
  { slug: 'cohere', url: /^https:\/\/api\.cohere\.com\/v2\/chat$/, auth: bearer }
];

let basicPrompt: LanguageModelV4CallOptions = {
  prompt: [
    { role: 'system', content: 'Be brief.' },
    { role: 'user', content: [{ type: 'text', text: 'Say hello' }] }
  ],
  maxOutputTokens: 64
};

let collect = async (stream: ReadableStream<LanguageModelV4StreamPart>) => {
  let parts: LanguageModelV4StreamPart[] = [];
  let reader = stream.getReader();
  while (true) {
    let next = await reader.read();
    if (next.done) break;
    parts.push(next.value);
  }

  return parts;
};

let run = async (d: {
  slug: string;
  script: Script;
  config?: Record<string, string>;
  options?: LanguageModelV4CallOptions;
  fragmentBytes?: number;
}) => {
  let upstream = createFakeUpstream(d.script, { fragmentBytes: d.fragmentBytes });
  let model = createProviderLanguageModel({
    providerSlug: d.slug,
    credentials: { apiKey },
    config: d.config ?? {},
    modelId: 'test-model',
    fetch: upstream.fetch
  });

  let options = prepareProviderCallOptions({
    providerSlug: d.slug,
    options: d.options ?? basicPrompt
  });
  let result = await model.doStream(options);
  let parts = await collect(result.stream);

  return { parts, upstream };
};

let textOf = (parts: LanguageModelV4StreamPart[]) =>
  parts.flatMap(part => (part.type == 'text-delta' ? [part.delta] : [])).join('');

let reasoningOf = (parts: LanguageModelV4StreamPart[]) =>
  parts.flatMap(part => (part.type == 'reasoning-delta' ? [part.delta] : [])).join('');

let finishOf = (parts: LanguageModelV4StreamPart[]) => {
  let finish = parts.find(part => part.type == 'finish');
  if (finish?.type != 'finish') throw new Error('The stream did not finish.');

  return finish;
};

let toolCallsOf = (parts: LanguageModelV4StreamPart[]) =>
  parts.flatMap(part =>
    part.type == 'tool-call'
      ? [{ id: part.toolCallId, name: part.toolName, input: JSON.parse(part.input) }]
      : []
  );

describe('provider language models', () => {
  it('covers every inference provider', () => {
    let inference = providerDefinitions
      .filter(definition => providerKindOf(definition) == 'inference')
      .map(definition => definition.slug)
      .sort();

    expect(providerCases.map(entry => entry.slug).sort()).toEqual(inference);
  });

  it('does not build models for decision providers', () => {
    expect(() =>
      createProviderLanguageModel({
        providerSlug: 'typesafe',
        credentials: { apiKey },
        config: {},
        modelId: 'jev'
      })
    ).toThrow('does not serve language models');
  });

  describe.each(providerCases)('$slug', providerCase => {
    it('streams a text response over the real wire format', async () => {
      let { parts, upstream } = await run({
        slug: providerCase.slug,
        config: providerCase.config,
        script: {
          steps: [{ type: 'text', text: 'Hello there, friend! 👋' }],
          usage: { input: 21, output: 9 }
        }
      });

      expect(upstream.requests).toHaveLength(1);

      let request = upstream.requests[0]!;
      expect(request.url).toMatch(providerCase.url);
      expect(request.method).toBe('POST');
      expect(providerCase.auth(request.headers)).toBe(true);
      if (providerCase.modelInBody !== false) expect(request.body.model).toBe('test-model');
      expect(JSON.stringify(request.body)).toContain('Say hello');

      expect(textOf(parts)).toBe('Hello there, friend! 👋');

      let finish = finishOf(parts);
      expect(finish.finishReason.unified).toBe('stop');
      expect(finish.usage.inputTokens.total).toBe(21);
      expect(finish.usage.outputTokens.total).toBe(9);
    });

    it('streams tool calls with parsed arguments', async () => {
      let { parts, upstream } = await run({
        slug: providerCase.slug,
        config: providerCase.config,
        options: {
          ...basicPrompt,
          tools: [
            {
              type: 'function',
              name: 'get_weather',
              description: 'Look up the weather',
              inputSchema: {
                type: 'object',
                properties: { city: { type: 'string' } },
                required: ['city']
              }
            }
          ],
          toolChoice: { type: 'auto' }
        },
        script: {
          steps: [
            { type: 'tool-call', id: 'call_1', name: 'get_weather', input: { city: 'Zürich' } }
          ],
          usage: { input: 30, output: 12 }
        }
      });

      expect(JSON.stringify(upstream.requests[0]!.body)).toContain('get_weather');

      let calls = toolCallsOf(parts);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('get_weather');
      expect(calls[0]!.input).toEqual({ city: 'Zürich' });
      expect(finishOf(parts).finishReason.unified).toBe('tool-calls');
    });

    it('reports a truncated response as length', async () => {
      let { parts } = await run({
        slug: providerCase.slug,
        config: providerCase.config,
        script: { steps: [{ type: 'text', text: 'Once upon a' }], finish: 'length' }
      });

      expect(finishOf(parts).finishReason.unified).toBe('length');
    });

    it('surfaces upstream http errors as API call errors', async () => {
      let upstream = createFakeUpstream({
        steps: [],
        httpError: {
          status: 429,
          body: { error: { message: 'Slow down', type: 'rate_limit_error' } },
          headers: { 'retry-after': '7' }
        }
      });
      let model = createProviderLanguageModel({
        providerSlug: providerCase.slug,
        credentials: { apiKey },
        config: providerCase.config ?? {},
        modelId: 'test-model',
        fetch: upstream.fetch
      });

      let error = await model.doStream({ ...basicPrompt }).then(
        () => null,
        (error: any) => error
      );

      expect(error?.statusCode).toBe(429);
      expect(error?.responseHeaders?.['retry-after']).toBe('7');
    });

    it('parses streams cut at arbitrary byte boundaries', async () => {
      let { parts } = await run({
        slug: providerCase.slug,
        config: providerCase.config,
        fragmentBytes: 7,
        script: { steps: [{ type: 'text', text: 'Grüße aus Zürich – 你好 🌍' }], chunkSize: 3 }
      });

      expect(textOf(parts)).toBe('Grüße aus Zürich – 你好 🌍');
    });
  });
});

describe('reasoning on the wire', () => {
  it('reads Anthropic thinking with its signature', async () => {
    let { parts } = await run({
      slug: 'anthropic',
      script: {
        steps: [
          { type: 'reasoning', text: 'Let me think.', signature: 'sig-abc' },
          { type: 'text', text: 'Done.' }
        ]
      }
    });

    expect(reasoningOf(parts)).toBe('Let me think.');
    expect(textOf(parts)).toBe('Done.');

    let metadata = parts.flatMap(part =>
      'providerMetadata' in part && part.providerMetadata?.anthropic
        ? [part.providerMetadata.anthropic]
        : []
    );
    expect(metadata).toContainEqual(expect.objectContaining({ signature: 'sig-abc' }));
  });

  it('reads Anthropic redacted thinking as reasoning metadata', async () => {
    let { parts } = await run({
      slug: 'anthropic',
      script: {
        steps: [
          { type: 'reasoning', text: '', redacted: 'opaque-data' },
          { type: 'text', text: 'Hi' }
        ]
      }
    });

    let metadata = parts.flatMap(part =>
      'providerMetadata' in part && part.providerMetadata?.anthropic
        ? [part.providerMetadata.anthropic]
        : []
    );
    expect(metadata).toContainEqual(expect.objectContaining({ redactedData: 'opaque-data' }));
  });

  it('reads OpenAI reasoning summaries with encrypted content', async () => {
    let { parts } = await run({
      slug: 'openai',
      script: {
        steps: [
          { type: 'reasoning', text: 'Weighing options.', signature: 'enc-123' },
          { type: 'text', text: 'Answer.' }
        ],
        usage: { input: 10, output: 40, reasoning: 30 }
      }
    });

    expect(reasoningOf(parts)).toBe('Weighing options.');
    expect(finishOf(parts).usage.outputTokens.reasoning).toBe(30);

    let metadata = parts.flatMap(part =>
      'providerMetadata' in part && part.providerMetadata?.openai
        ? [part.providerMetadata.openai]
        : []
    );
    expect(metadata).toContainEqual(
      expect.objectContaining({ reasoningEncryptedContent: 'enc-123' })
    );
  });

  it('reads Gemini thoughts', async () => {
    let { parts } = await run({
      slug: 'google-ai-studio',
      script: {
        steps: [
          { type: 'reasoning', text: 'Considering.', signature: 'thought-sig' },
          { type: 'text', text: 'Yes.' }
        ],
        usage: { input: 5, output: 20, reasoning: 12 }
      }
    });

    expect(reasoningOf(parts)).toBe('Considering.');
    expect(textOf(parts)).toBe('Yes.');
    expect(finishOf(parts).usage.outputTokens.reasoning).toBe(12);
  });

  it('reads DeepSeek reasoning content', async () => {
    let { parts } = await run({
      slug: 'deepseek',
      script: {
        steps: [
          { type: 'reasoning', text: 'Hmm.' },
          { type: 'text', text: 'Ok.' }
        ]
      }
    });

    expect(reasoningOf(parts)).toBe('Hmm.');
    expect(textOf(parts)).toBe('Ok.');
  });
});

describe('cached input on the wire', () => {
  it.each(['openai', 'anthropic', 'google-ai-studio'])(
    'reports cache reads from %s',
    async slug => {
      let { parts } = await run({
        slug,
        script: {
          steps: [{ type: 'text', text: 'Hi' }],
          usage: { input: 100, output: 5, cacheRead: 900 }
        }
      });

      let usage = finishOf(parts).usage;
      expect(usage.inputTokens.cacheRead).toBe(900);
      expect(usage.inputTokens.total).toBe(1000);
    }
  );

  it('reports Anthropic cache writes', async () => {
    let { parts } = await run({
      slug: 'anthropic',
      script: {
        steps: [{ type: 'text', text: 'Hi' }],
        usage: { input: 50, output: 5, cacheWrite: 400 }
      }
    });

    expect(finishOf(parts).usage.inputTokens.cacheWrite).toBe(400);
  });
});

describe('enforced provider options', () => {
  it('never lets OpenAI store generations', async () => {
    let { upstream } = await run({
      slug: 'openai',
      options: { ...basicPrompt, providerOptions: { openai: { store: true } } },
      script: { steps: [{ type: 'text', text: 'Hi' }] }
    });

    expect(upstream.requests[0]!.body.store).toBe(false);
  });

  it('never lets Azure store generations', async () => {
    let { upstream } = await run({
      slug: 'azure',
      config: { resourceName: 'acme-ai' },
      script: { steps: [{ type: 'text', text: 'Hi' }] }
    });

    expect(upstream.requests[0]!.body.store).toBe(false);
  });

  it('asks OpenAI reasoning models for encrypted reasoning when not storing', async () => {
    let upstream = createFakeUpstream({ steps: [{ type: 'text', text: 'Hi' }] });
    let model = createProviderLanguageModel({
      providerSlug: 'openai',
      credentials: { apiKey },
      config: {},
      modelId: 'o4-mini',
      fetch: upstream.fetch
    });

    let result = await model.doStream(
      prepareProviderCallOptions({ providerSlug: 'openai', options: basicPrompt })
    );
    await collect(result.stream);

    expect(upstream.requests[0]!.body.include).toContain('reasoning.encrypted_content');
  });
});

describe('prepareProviderCallOptions', () => {
  it('copies OpenAI options to Azure at every level', () => {
    let prepared = prepareProviderCallOptions({
      providerSlug: 'azure',
      options: {
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/png',
                data: { type: 'url', url: new URL('https://example.com/a.png') },
                providerOptions: { openai: { imageDetail: 'low' } }
              }
            ]
          }
        ],
        providerOptions: { openai: { reasoningSummary: 'auto', parallelToolCalls: false } }
      }
    });

    expect((prepared.providerOptions as Record<string, unknown> | undefined)?.azure).toEqual({
      reasoningSummary: 'auto',
      parallelToolCalls: false,
      store: false
    });

    let part = prepared.prompt[0]!.content[0] as any;
    expect(part.providerOptions.azure).toEqual({ imageDetail: 'low' });
  });

  it('lets explicit Azure options win over inherited OpenAI options', () => {
    let prepared = prepareProviderCallOptions({
      providerSlug: 'azure',
      options: {
        prompt: [],
        providerOptions: {
          openai: { reasoningSummary: 'auto' },
          azure: { reasoningSummary: 'detailed' }
        }
      }
    });

    expect(prepared.providerOptions?.azure?.reasoningSummary).toBe('detailed');
  });

  it('leaves providers without inheritance untouched', () => {
    let options = {
      prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hi' }] }],
      providerOptions: { openai: { parallelToolCalls: false } }
    };

    let prepared = prepareProviderCallOptions({ providerSlug: 'anthropic', options });

    expect(prepared.providerOptions).toEqual({ openai: { parallelToolCalls: false } });
    expect(prepared.prompt).toEqual(options.prompt);
  });

  it('declares an options namespace for every inference provider', () => {
    for (let definition of providerDefinitions) {
      if (providerKindOf(definition) != 'inference') continue;
      expect(getProviderDefinition(definition.slug).providerOptionsKey).toBeTruthy();
      expect(definition.languageModel).toBeTypeOf('function');
    }
  });
});
