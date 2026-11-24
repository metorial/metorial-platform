import { describe, expect, it } from 'vitest';
import {
  describeWait,
  goDuration,
  limitExceededError,
  rateLimitHeaders,
  requestTooLargeError,
  retryAfter,
  type RateSnapshot
} from '../src/lib/messages';
import { limitRules } from '../src/lib/rules';
import { noon, principalWith } from './fixtures';

describe('goDuration', () => {
  it.each([
    [0, '0ms'],
    [20, '20ms'],
    [999.2, '1000ms'],
    [1000, '1s'],
    [1500, '1.5s'],
    [59_999, '59.999s'],
    [60_000, '1m0s'],
    [360_000, '6m0s'],
    [3_723_000, '1h2m3s']
  ])('formats %d ms as %s', (ms, formatted) => {
    expect(goDuration(ms)).toBe(formatted);
  });
});

describe('describeWait', () => {
  it.each([
    [0, '1 second'],
    [1200, '2 seconds'],
    [59_000, '59 seconds'],
    [60_000, '1 minute'],
    [61_000, '2 minutes'],
    [3_600_000, '1 hour'],
    [5 * 86_400_000, '5 days']
  ])('describes %d ms as "%s"', (ms, text) => {
    expect(describeWait(ms)).toBe(text);
  });
});

describe('limit errors', () => {
  let ruleOf = (principal: ReturnType<typeof principalWith>) =>
    limitRules(principal, noon)[0]!;

  it('names the API key for token limits', () => {
    let rule = ruleOf(
      principalWith({ token: [{ metric: 'requests', amount: 10, interval: '1m' }] })
    );

    expect(limitExceededError(rule, noon + 30_000)).toEqual({
      status: 429,
      code: 'rate_limit_exceeded',
      message: 'This API key is limited to 10 requests per minute. Try again in 30 seconds.'
    });
  });

  it('names the instance for instance limits', () => {
    let rule = ruleOf(
      principalWith({ instance: [{ metric: 'tokens', amount: 5000, interval: '1h' }] })
    );

    expect(limitExceededError(rule, noon).message).toBe(
      'This gateway instance is limited to 5000 tokens per hour. Try again in 1 hour.'
    );
  });

  it('reports spend limits with their own code', () => {
    let rule = ruleOf(
      principalWith({ token: [{ metric: 'spend_usd', amount: 25, interval: '1mo' }] })
    );

    expect(limitExceededError(rule, noon)).toMatchObject({
      status: 429,
      code: 'spend_limit_exceeded',
      message: expect.stringContaining('reached its spend limit of $25 per month')
    });
  });

  it('points plan limits at the plan', () => {
    let rule = ruleOf(
      principalWith({
        platform: [{ metric: 'tokens', amount: 100_000, intervalSeconds: 86_400 }]
      })
    );

    expect(limitExceededError(rule, noon)).toEqual({
      status: 429,
      code: 'plan_limit_exceeded',
      message: "This project's plan allows 100000 tokens per day. Try again in 12 hours."
    });
  });

  it('suggests own provider keys when the Metorial-billed allowance is used up', () => {
    let rule = ruleOf(
      principalWith({
        platform: [{ metric: 'metorial_spend_usd', amount: 0.5, intervalSeconds: 86_400 }]
      })
    );

    expect(limitExceededError(rule, noon).message).toBe(
      "This project's plan includes $0.5 of Metorial-billed usage per day. Connect your own provider keys or try again in 12 hours."
    );
  });

  it('explains requests that can never fit a token limit', () => {
    let rule = ruleOf(
      principalWith({ token: [{ metric: 'tokens', amount: 1000, interval: '1m' }] })
    );

    expect(requestTooLargeError(rule, 4000)).toEqual({
      status: 429,
      code: 'rate_limit_exceeded',
      message:
        'This request needs about 4000 input tokens, but this API key only allows 1000 tokens per minute.'
    });
  });

  it('rounds retry-after up to whole seconds and never below one', () => {
    let rule = ruleOf(
      principalWith({ token: [{ metric: 'requests', amount: 1, interval: '1m' }] })
    );

    expect(retryAfter(rule, noon)).toBe('60');
    expect(retryAfter(rule, noon + 59_001)).toBe('1');
    expect(retryAfter(rule, noon + 59_999)).toBe('1');
  });
});

describe('rateLimitHeaders', () => {
  let snapshots: RateSnapshot[] = [
    { metric: 'requests', limit: 100, remaining: 40, resetAt: noon + 30_000 },
    { metric: 'requests', limit: 10, remaining: 3, resetAt: noon + 1500 },
    { metric: 'tokens', limit: 5000, remaining: 4000, resetAt: noon + 3_600_000 }
  ];

  it('uses the OpenAI header names for the OpenAI dialects', () => {
    let expected = {
      'x-ratelimit-limit-requests': '10',
      'x-ratelimit-remaining-requests': '3',
      'x-ratelimit-reset-requests': '1.5s',
      'x-ratelimit-limit-tokens': '5000',
      'x-ratelimit-remaining-tokens': '4000',
      'x-ratelimit-reset-tokens': '1h0m0s'
    };

    expect(rateLimitHeaders('openai_chat', snapshots, noon)).toEqual(expected);
    expect(rateLimitHeaders('open_responses', snapshots, noon)).toEqual(expected);
  });

  it('uses the Anthropic header names with RFC 3339 resets', () => {
    expect(rateLimitHeaders('anthropic_messages', snapshots, noon)).toEqual({
      'anthropic-ratelimit-requests-limit': '10',
      'anthropic-ratelimit-requests-remaining': '3',
      'anthropic-ratelimit-requests-reset': '2026-11-20T12:00:01Z',
      'anthropic-ratelimit-tokens-limit': '5000',
      'anthropic-ratelimit-tokens-remaining': '4000',
      'anthropic-ratelimit-tokens-reset': '2026-11-20T13:00:00Z'
    });
  });

  it('breaks ties on remaining by the earliest reset', () => {
    let headers = rateLimitHeaders(
      'openai_chat',
      [
        { metric: 'tokens', limit: 100, remaining: 0, resetAt: noon + 60_000 },
        { metric: 'tokens', limit: 900, remaining: 0, resetAt: noon + 1000 }
      ],
      noon
    );

    expect(headers['x-ratelimit-limit-tokens']).toBe('900');
  });

  it('sends nothing without snapshots', () => {
    expect(rateLimitHeaders('openai_chat', [], noon)).toEqual({});
  });
});
