import Anthropic from '@anthropic-ai/sdk';
import { createGatewayLimiter, createMemoryLimitStore } from '@mtsrc/ai-gateway-module-limits';
import type { GatewayLimit, GatewayPrincipal, PlatformLimit } from '@mtsrc/ai-gateway-spec';
import type { Script } from '@mtsrc/ai-gateway-testing';
import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { ask, chatRequest, messagesRequest, responsesRequest } from './clients';
import { createGateway, principal, providerCases } from './harness';

let hello: Script = { steps: [{ type: 'text', text: 'Hello.' }] };

let limited = (d: {
  token?: GatewayLimit[];
  instance?: GatewayLimit[];
  platform?: PlatformLimit[];
}): GatewayPrincipal => ({
  ...principal,
  token: { ...principal.token, limits: d.token ?? [] },
  instance: { ...principal.instance, limits: d.instance ?? [] },
  project: { ...principal.project, platformLimits: d.platform ?? [] }
});

let caught = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('Expected the request to fail.');
};

let settled = () => new Promise(resolve => setTimeout(resolve, 0));

let newLimiter = () => createGatewayLimiter({ store: createMemoryLimitStore() });

describe('request limits reach clients as their own rate limit errors', () => {
  let twoPerMinute = limited({ token: [{ metric: 'requests', amount: 2, interval: '1m' }] });

  it('gives OpenAI clients a RateLimitError with OpenAI rate limit headers', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: hello,
      principal: twoPerMinute,
      limiter: newLimiter()
    });

    let first = await gateway.openai.chat.completions
      .create(chatRequest({ prompt: 'hi' }))
      .withResponse();
    await gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }));
    let error = await caught(
      gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }))
    );

    expect(first.response.headers.get('x-ratelimit-limit-requests')).toBe('2');
    expect(first.response.headers.get('x-ratelimit-remaining-requests')).toBe('1');
    expect(first.response.headers.get('x-ratelimit-reset-requests')).toMatch(
      /^\d+(\.\d+)?s$|ms$/
    );

    expect(error).toBeInstanceOf(OpenAI.RateLimitError);
    let rateLimit = error as InstanceType<typeof OpenAI.RateLimitError>;
    expect(rateLimit.status).toBe(429);
    expect(rateLimit.code).toBe('rate_limit_exceeded');
    expect(rateLimit.message).toContain('This API key is limited to 2 requests per minute');
    expect(rateLimit.headers.get('x-ratelimit-remaining-requests')).toBe('0');
    expect(Number(rateLimit.headers.get('retry-after'))).toBeGreaterThan(0);

    expect(gateway.upstream.requests).toHaveLength(2);
    expect(gateway.logs[2]!.log).toMatchObject({
      status: 'rejected',
      error: { stage: 'limits', code: 'rate_limit_exceeded', httpStatus: 429 }
    });
  });

  it('gives Anthropic clients a RateLimitError with Anthropic rate limit headers', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: hello,
      principal: twoPerMinute,
      limiter: newLimiter()
    });

    let first = await gateway.anthropic.messages
      .create(messagesRequest({ prompt: 'hi' }))
      .withResponse();
    await gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }));
    let error = await caught(
      gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }))
    );

    expect(first.response.headers.get('anthropic-ratelimit-requests-limit')).toBe('2');
    expect(first.response.headers.get('anthropic-ratelimit-requests-remaining')).toBe('1');
    expect(first.response.headers.get('anthropic-ratelimit-requests-reset')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    );
    expect(first.response.headers.get('x-ratelimit-limit-requests')).toBeNull();

    expect(error).toBeInstanceOf(Anthropic.RateLimitError);
    let rateLimit = error as InstanceType<typeof Anthropic.RateLimitError>;
    expect(rateLimit.error).toEqual({
      type: 'error',
      error: {
        type: 'rate_limit_error',
        message: expect.stringContaining('2 requests per minute')
      }
    });
    expect(rateLimit.headers?.get('anthropic-ratelimit-requests-remaining')).toBe('0');
  });

  it('rejects streamed Responses requests before any event is sent', async () => {
    let gateway = createGateway({
      providers: ['google-ai-studio'],
      upstream: hello,
      principal: limited({ instance: [{ metric: 'requests', amount: 1, interval: '1h' }] }),
      limiter: newLimiter()
    });

    await ask(gateway, 'open_responses', { prompt: 'hi' }, { stream: true });
    let error = await caught(
      gateway.openai.responses.create({ ...responsesRequest({ prompt: 'hi' }), stream: true })
    );

    expect(error).toBeInstanceOf(OpenAI.RateLimitError);
    expect((error as InstanceType<typeof OpenAI.RateLimitError>).message).toContain(
      'This gateway instance is limited to 1 requests per hour'
    );
  });

  it('shares an instance limit across gateway tokens', async () => {
    let limiter = newLimiter();
    let instanceLimit: GatewayLimit[] = [{ metric: 'requests', amount: 1, interval: '1m' }];
    let tokenA = createGateway({
      providers: ['openai'],
      upstream: hello,
      principal: {
        ...limited({ instance: instanceLimit }),
        token: { ...principal.token, id: 'agtk_a' }
      },
      limiter
    });
    let tokenB = createGateway({
      providers: ['openai'],
      upstream: hello,
      principal: {
        ...limited({ instance: instanceLimit }),
        token: { ...principal.token, id: 'agtk_b' }
      },
      limiter
    });

    await tokenA.openai.chat.completions.create(chatRequest({ prompt: 'hi' }));

    expect(
      await caught(tokenB.openai.chat.completions.create(chatRequest({ prompt: 'hi' })))
    ).toBeInstanceOf(OpenAI.RateLimitError);
  });

  it('does not limit token counting', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: hello,
      principal: limited({
        platform: [{ metric: 'requests', amount: 0, intervalSeconds: 60 }]
      }),
      limiter: newLimiter(),
      countTokens: 77
    });

    let counted = await gateway.anthropic.messages.countTokens({
      model: 'lab/test-model',
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(counted.input_tokens).toBe(77);
  });
});

describe('token limits charge what each provider reported', () => {
  for (let provider of providerCases) {
    it(`charges ${provider.slug} usage against the token limit`, async () => {
      let gateway = createGateway({
        providers: [provider],
        upstream: { ...hello, usage: { input: 300, output: 120 } },
        principal: limited({ token: [{ metric: 'tokens', amount: 1000, interval: '1h' }] }),
        limiter: newLimiter()
      });

      let turn = await ask(gateway, 'openai_chat', { prompt: 'hi' }, { stream: true });
      await settled();

      let next = await gateway.openai.chat.completions
        .create(chatRequest({ prompt: 'hi' }))
        .withResponse();

      expect(turn.usage).toEqual({ input: 300, output: 120 });
      expect(next.response.headers.get('x-ratelimit-remaining-tokens')).toBe('580');
    });
  }

  it('denies once the reported usage exhausts the limit', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: { ...hello, usage: { input: 600, output: 400 } },
      principal: limited({ token: [{ metric: 'tokens', amount: 1000, interval: '1h' }] }),
      limiter: newLimiter()
    });

    await gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }));
    await settled();

    let error = await caught(
      gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(Anthropic.RateLimitError);
    expect(
      (error as InstanceType<typeof Anthropic.RateLimitError>).headers?.get(
        'anthropic-ratelimit-tokens-remaining'
      )
    ).toBe('0');
  });

  it('does not charge requests that failed upstream', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: {
        steps: [],
        usage: { input: 5000, output: 5000 },
        httpError: { status: 500, body: { error: { message: 'boom' } } }
      },
      principal: limited({ token: [{ metric: 'tokens', amount: 1000, interval: '1h' }] }),
      limiter: newLimiter()
    });

    await caught(gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' })));
    await settled();

    let error = await caught(
      gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }))
    );
    expect(error).not.toBeInstanceOf(OpenAI.RateLimitError);
  });
});

describe('spend limits', () => {
  // The harness prices tokens at $3 / $15 per million, so the default 12 in / 7 out costs
  // $0.000141.
  it('denies once the billed cost reaches the limit', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: hello,
      principal: limited({ token: [{ metric: 'spend_usd', amount: 0.0002, interval: '1d' }] }),
      limiter: newLimiter()
    });

    await gateway.openai.responses.create(responsesRequest({ prompt: 'hi' }));
    await settled();
    await gateway.openai.responses.create(responsesRequest({ prompt: 'hi' }));
    await settled();

    let error = await caught(
      gateway.openai.responses.create(responsesRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(OpenAI.RateLimitError);
    expect((error as InstanceType<typeof OpenAI.RateLimitError>).code).toBe(
      'spend_limit_exceeded'
    );
  });
});

describe('platform limits', () => {
  let metorialAllowance = limited({
    platform: [{ metric: 'metorial_spend_usd', amount: 0.0001, intervalSeconds: 86_400 }]
  });

  it('moves traffic to customer connections once the Metorial-billed allowance is used up', async () => {
    let gateway = createGateway({
      providers: ['anthropic', 'openai'],
      owner: ['platform', 'customer'],
      upstream: hello,
      principal: metorialAllowance,
      limiter: newLimiter()
    });

    await gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }));
    await settled();
    await gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }));

    expect(gateway.upstream.requests.map(request => new URL(request.url).hostname)).toEqual([
      'api.anthropic.com',
      'api.openai.com'
    ]);
    expect(gateway.logs.map(record => record.log.route?.connectionOwner)).toEqual([
      'platform',
      'customer'
    ]);
  });

  it('rejects with a plan error when only Metorial could serve', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      owner: 'platform',
      upstream: hello,
      principal: metorialAllowance,
      limiter: newLimiter()
    });

    await gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }));
    await settled();

    let error = await caught(
      gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(Anthropic.RateLimitError);
    expect((error as InstanceType<typeof Anthropic.RateLimitError>).message).toContain(
      'Connect your own provider keys'
    );
    expect(gateway.upstream.requests).toHaveLength(1);
    expect(gateway.logs[1]!.log).toMatchObject({
      status: 'rejected',
      error: { stage: 'limits', code: 'plan_limit_exceeded' }
    });
  });

  it('never spends the Metorial allowance on customer connections', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: hello,
      principal: metorialAllowance,
      limiter: newLimiter()
    });

    for (let i = 0; i < 3; i++) {
      await gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }));
      await settled();
    }

    expect(gateway.logs.map(record => record.log.status)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded'
    ]);
  });

  it('applies plan token limits to customer connections too', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: { ...hello, usage: { input: 80, output: 30 } },
      principal: limited({
        platform: [{ metric: 'tokens', amount: 100, intervalSeconds: 86_400 }]
      }),
      limiter: newLimiter()
    });

    await gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }));
    await settled();

    let error = await caught(
      gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(OpenAI.RateLimitError);
    expect((error as InstanceType<typeof OpenAI.RateLimitError>).code).toBe(
      'plan_limit_exceeded'
    );
  });
});
