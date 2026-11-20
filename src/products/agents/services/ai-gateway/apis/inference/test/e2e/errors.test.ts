import Anthropic from '@anthropic-ai/sdk';
import type { Script } from '@mtsrc/ai-gateway-testing';
import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { ask, chatRequest, messagesRequest, model, responsesRequest } from './clients';
import { createGateway, principal } from './harness';

let hello: Script = { steps: [{ type: 'text', text: 'Hello.' }] };

let httpError = (
  status: number,
  message: string,
  headers?: Record<string, string>
): Script => ({
  steps: [],
  httpError: {
    status,
    body: { type: 'error', error: { type: 'some_error', message } },
    headers
  }
});

let byHost =
  (scripts: Record<string, Script>) =>
  (request: { url: string }): Script =>
    scripts[new URL(request.url).hostname] ?? hello;

let caught = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('Expected the request to fail.');
};

describe('upstream errors reach clients in their own error format', () => {
  it('shows an invalid request to OpenAI clients with code and status', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: httpError(400, 'max_tokens: too large')
    });

    let error = await caught(
      gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(OpenAI.BadRequestError);
    let apiError = error as InstanceType<typeof OpenAI.BadRequestError>;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe('upstream_invalid_request');
    expect(apiError.message).toContain(
      'Anthropic rejected the request: max_tokens: too large'
    );
    expect(apiError.headers.get('x-metorial-request-id')).toBe('gwlg_1');
  });

  it('shows an invalid request to Anthropic clients with their error type', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: httpError(400, 'bad tool schema')
    });

    let error = await caught(
      gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect((error as InstanceType<typeof Anthropic.BadRequestError>).error).toEqual({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'OpenAI rejected the request: bad tool schema'
      }
    });
  });

  it('reports rejected customer credentials and schedules a connection check', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: httpError(401, 'invalid x-api-key')
    });

    let error = await caught(
      gateway.openai.responses.create(responsesRequest({ prompt: 'hi' }))
    );

    expect((error as InstanceType<typeof OpenAI.APIError>).status).toBe(502);
    expect((error as InstanceType<typeof OpenAI.APIError>).message).toContain(
      'rejected the credentials of your provider connection'
    );
    expect(gateway.reportAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('passes retry-after through when every provider is rate limiting', async () => {
    let gateway = createGateway({
      providers: ['openai', 'anthropic'],
      upstream: httpError(429, 'slow down', { 'retry-after': '17' })
    });

    let error = await caught(
      gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(Anthropic.RateLimitError);
    expect(
      (error as InstanceType<typeof Anthropic.RateLimitError>).headers?.get('retry-after')
    ).toBe('17');
    expect(gateway.upstream.requests).toHaveLength(2);
    expect(gateway.logs[0]!.log.attempts.map(attempt => attempt.outcome)).toEqual([
      'failed',
      'failed'
    ]);
  });

  it('hides which provider failed on Metorial-provided routes', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      owner: 'platform',
      upstream: httpError(401, 'invalid x-api-key sk-ant-123')
    });

    let error = await caught(
      gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }))
    );
    let message = (error as Error).message;

    expect(message).toContain('The model provider is temporarily unavailable.');
    expect(message).not.toContain('Anthropic');
    expect(message).not.toContain('sk-ant');
  });
});

describe('fallback across providers', () => {
  for (let dialect of ['openai_chat', 'open_responses', 'anthropic_messages'] as const) {
    for (let stream of [false, true]) {
      it(`answers from the next provider after an outage (${dialect}, ${stream ? 'streamed' : 'buffered'})`, async () => {
        let gateway = createGateway({
          providers: ['openai', 'anthropic'],
          upstream: byHost({ 'api.openai.com': httpError(503, 'overloaded') })
        });

        let turn = await ask(gateway, dialect, { prompt: 'hi' }, { stream });

        expect(turn.text).toBe('Hello.');
        expect(
          gateway.upstream.requests.map(request => new URL(request.url).hostname)
        ).toEqual(['api.openai.com', 'api.anthropic.com']);
        expect(gateway.logs[0]!.log).toMatchObject({
          status: 'succeeded',
          route: { providerSlug: 'anthropic' },
          attempts: [
            {
              providerSlug: 'openai',
              outcome: 'failed',
              error: { code: 'upstream_overloaded', httpStatus: 503 }
            },
            { providerSlug: 'anthropic', outcome: 'succeeded' }
          ]
        });
      });
    }
  }

  it('falls back when a stream fails before any output', async () => {
    let gateway = createGateway({
      providers: ['anthropic', 'openai'],
      upstream: byHost({
        'api.anthropic.com': { steps: [], failMidStream: { message: 'Overloaded' } }
      })
    });

    let turn = await ask(gateway, 'openai_chat', { prompt: 'hi' }, { stream: true });

    expect(turn.text).toBe('Hello.');
    expect(gateway.logs[0]!.log.route).toMatchObject({ providerSlug: 'openai' });
  });

  it('falls back from a buffered request that failed halfway through', async () => {
    let gateway = createGateway({
      providers: ['google-ai-studio', 'anthropic'],
      upstream: byHost({
        'generativelanguage.googleapis.com': {
          steps: [{ type: 'text', text: 'Partial answer' }],
          failMidStream: { message: 'Internal error' }
        }
      })
    });

    let turn = await ask(gateway, 'anthropic_messages', { prompt: 'hi' }, { stream: false });

    expect(turn.text).toBe('Hello.');
  });

  it('does not fall back on a request the provider rejected as invalid', async () => {
    let gateway = createGateway({
      providers: ['openai', 'anthropic'],
      upstream: byHost({ 'api.openai.com': httpError(400, 'invalid') })
    });

    await caught(gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' })));

    expect(gateway.upstream.requests).toHaveLength(1);
  });

  it('identifies the answering provider in the response headers', async () => {
    let gateway = createGateway({
      providers: ['openai', 'anthropic'],
      upstream: byHost({ 'api.openai.com': httpError(500, 'boom') })
    });

    let { data, response } = await gateway.openai.chat.completions
      .create(chatRequest({ prompt: 'hi' }))
      .withResponse();

    expect(data.id).toBe('chatcmpl-gwlg_1');
    expect(response.headers.get('x-metorial-request-id')).toBe('gwlg_1');
    expect(response.headers.get('x-metorial-provider')).toBe('anthropic');
    expect(response.headers.get('x-metorial-model')).toBe('lab/test-model');
  });
});

describe('streams that fail after output started', () => {
  it('raise an error in the OpenAI SDK stream', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: {
        steps: [{ type: 'text', text: 'Partial' }],
        failMidStream: { message: 'Overloaded' }
      }
    });

    let error = await caught(ask(gateway, 'openai_chat', { prompt: 'hi' }, { stream: true }));

    expect(error).toBeInstanceOf(OpenAI.APIError);
    expect(gateway.upstream.requests).toHaveLength(1);
    expect(gateway.logs[0]!.log).toMatchObject({
      status: 'failed',
      error: { stage: 'upstream' }
    });
  });

  it('raise an error in the Anthropic SDK stream', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: {
        steps: [{ type: 'text', text: 'Partial' }],
        failMidStream: { message: 'server_error' }
      }
    });

    let error = await caught(
      ask(gateway, 'anthropic_messages', { prompt: 'hi' }, { stream: true })
    );

    expect(error).toBeInstanceOf(Anthropic.APIError);
    expect(gateway.logs[0]!.log.status).toBe('failed');
  });

  it('raise an error in the OpenAI Responses stream', async () => {
    let gateway = createGateway({
      providers: ['google-ai-studio'],
      upstream: {
        steps: [{ type: 'text', text: 'Partial' }],
        failMidStream: { message: 'Internal' }
      }
    });

    let error = await caught(
      ask(gateway, 'open_responses', { prompt: 'hi' }, { stream: true })
    );

    expect(error).toBeInstanceOf(Error);
    expect(gateway.logs[0]!.log.status).toBe('failed');
  });
});

describe('requests the gateway rejects', () => {
  let rejections = [
    {
      name: 'several OpenAI choices',
      send: (gateway: ReturnType<typeof createGateway>) =>
        gateway.openai.chat.completions.create({ ...chatRequest({ prompt: 'hi' }), n: 2 }),
      param: 'n'
    },
    {
      name: 'stored Open Responses conversations',
      send: (gateway: ReturnType<typeof createGateway>) =>
        gateway.openai.responses.create({
          ...responsesRequest({ prompt: 'hi' }),
          previous_response_id: 'resp_1'
        }),
      param: 'previous_response_id'
    },
    {
      name: 'Anthropic MCP servers',
      send: (gateway: ReturnType<typeof createGateway>) =>
        gateway.anthropic.beta.messages.create({
          ...messagesRequest({ prompt: 'hi' }),
          mcp_servers: [{ type: 'url', url: 'https://mcp.example.com', name: 'x' }]
        }),
      param: 'mcp_servers'
    },
    {
      name: 'a missing model',
      send: (gateway: ReturnType<typeof createGateway>) =>
        gateway.openai.chat.completions.create({
          ...chatRequest({ prompt: 'hi' }),
          model: ''
        }),
      param: 'model'
    }
  ];

  for (let rejection of rejections) {
    it(`rejects ${rejection.name} without calling a provider and logs it`, async () => {
      let gateway = createGateway({ providers: ['anthropic'], upstream: hello });

      let error = (await caught(rejection.send(gateway))) as {
        status: number;
        param?: string;
      };

      expect(error.status).toBe(400);
      if ('param' in error && error.param !== undefined)
        expect(error.param).toBe(rejection.param);
      expect(gateway.upstream.requests).toHaveLength(0);
      expect(gateway.logs[0]!.log).toMatchObject({
        status: 'rejected',
        error: { stage: 'request', param: rejection.param }
      });
    });
  }
});

describe('token counting', () => {
  it('asks Anthropic for an exact count', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: hello,
      countTokens: 1234
    });

    let result = await gateway.anthropic.messages.countTokens({
      model,
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'Count me' }]
    });

    expect(result).toEqual({ input_tokens: 1234 });
    let request = gateway.upstream.requests[0]!;
    expect(request.wire).toBe('anthropic-count-tokens');
    expect(request.body).toMatchObject({
      model: 'claude-sonnet-4-5',
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'Count me' }]
    });
    expect(gateway.logs[0]!.log).toMatchObject({
      operation: 'count_tokens',
      usage: { input: { total: 1234 } }
    });
  });

  it('estimates for providers without a count endpoint', async () => {
    let gateway = createGateway({ providers: ['openai'], upstream: hello });

    let result = await gateway.anthropic.messages.countTokens({
      model,
      messages: [
        { role: 'user', content: 'Count me please, this is a slightly longer message.' }
      ]
    });

    expect(result.input_tokens).toBeGreaterThan(5);
    expect(gateway.upstream.requests).toHaveLength(0);
  });
});

describe('request context', () => {
  it('logs metadata sent in the metadata header', async () => {
    let gateway = createGateway({ providers: ['anthropic'], upstream: hello });

    await gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }), {
      headers: { 'x-metorial-metadata': JSON.stringify({ feature: 'search', user: 'u_1' }) }
    });

    expect(gateway.logs[0]!.log.metadata).toEqual({ feature: 'search', user: 'u_1' });
  });

  it('logs request and response content when the instance enables it', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: hello,
      principal: {
        ...principal,
        instance: {
          ...principal.instance,
          settings: {
            ...principal.instance.settings,
            contentLogging: { enabled: true, retentionDays: 2 }
          }
        }
      }
    });

    await ask(gateway, 'anthropic_messages', { prompt: 'Remember me' }, { stream: true });

    let content = gateway.logs[0]!.content!;
    expect(JSON.stringify(content.request)).toContain('Remember me');
    expect(content.response).toMatchObject({
      type: 'message',
      content: [{ type: 'text', text: 'Hello.' }]
    });
    expect(content.retentionDays).toBe(2);
  });
});
