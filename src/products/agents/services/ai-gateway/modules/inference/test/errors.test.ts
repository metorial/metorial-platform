import { createError, ServiceError } from '@lowerdeck/error';
import { apiCallError } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import {
  classifyUpstreamError,
  connectionUnavailableError,
  toGatewayError
} from '../src/lib/errors';

let customer = { providerSlug: 'anthropic', connectionOwner: 'customer' as const };
let platform = { providerSlug: 'anthropic', connectionOwner: 'platform' as const };

describe('classifyUpstreamError', () => {
  let cases: [number, number, string, boolean][] = [
    [400, 400, 'upstream_invalid_request', false],
    [401, 502, 'upstream_authentication_failed', true],
    [403, 502, 'upstream_authentication_failed', true],
    [404, 502, 'upstream_model_unavailable', true],
    [408, 504, 'upstream_timeout', true],
    [409, 502, 'upstream_error', true],
    [413, 413, 'upstream_invalid_request', false],
    [418, 502, 'upstream_error', false],
    [422, 400, 'upstream_invalid_request', false],
    [429, 429, 'upstream_rate_limited', true],
    [500, 502, 'upstream_error', true],
    [502, 502, 'upstream_error', true],
    [503, 503, 'upstream_overloaded', true],
    [504, 504, 'upstream_timeout', true],
    [529, 503, 'upstream_overloaded', true]
  ];

  for (let [upstream, status, code, retryable] of cases) {
    it(`maps an upstream ${upstream} to ${status} ${code}`, () => {
      let failure = classifyUpstreamError(apiCallError({ status: upstream }), customer);

      expect(failure.error.status).toBe(status);
      expect(failure.error.code).toBe(code);
      expect(failure.retryable).toBe(retryable);
      expect(failure.httpStatus).toBe(upstream);
      expect(failure.authFailure).toBe(upstream == 401 || upstream == 403);
    });
  }

  it('reads the provider message and code from an Anthropic error body', () => {
    let failure = classifyUpstreamError(
      apiCallError({
        status: 400,
        body: {
          type: 'error',
          error: { type: 'invalid_request_error', message: 'max_tokens: too large' }
        }
      }),
      customer
    );

    expect(failure.error.message).toBe(
      'Anthropic rejected the request: max_tokens: too large'
    );
    expect(failure.providerCode).toBe('invalid_request_error');
  });

  it('reads the provider message and code from an OpenAI error body', () => {
    let failure = classifyUpstreamError(
      apiCallError({
        status: 429,
        body: { error: { message: 'Slow down', code: 'rate_limit_exceeded' } }
      }),
      { providerSlug: 'openai', connectionOwner: 'customer' }
    );

    expect(failure.error.message).toBe('OpenAI is rate limiting requests: Slow down');
    expect(failure.providerCode).toBe('rate_limit_exceeded');
  });

  it('reads the first error of a Google error array', () => {
    let failure = classifyUpstreamError(
      apiCallError({
        status: 400,
        body: [{ error: { message: 'Bad schema', status: 'INVALID_ARGUMENT' } }]
      }),
      { providerSlug: 'google', connectionOwner: 'customer' }
    );

    expect(failure.error.message).toContain('Bad schema');
    expect(failure.providerCode).toBe('INVALID_ARGUMENT');
  });

  it('tolerates bodies that are not JSON', () => {
    let failure = classifyUpstreamError(
      apiCallError({ status: 502, body: undefined }),
      customer
    );

    expect(failure.error.message).toBe('Anthropic returned an error.');
  });

  it('copies retry-after from rate limit responses', () => {
    let failure = classifyUpstreamError(
      apiCallError({ status: 429, headers: { 'retry-after': '12' } }),
      customer
    );

    expect(failure.retryAfter).toBe('12');
  });

  it('tells customers their connection credentials were rejected', () => {
    let failure = classifyUpstreamError(apiCallError({ status: 401 }), customer);
    expect(failure.error.message).toContain(
      'rejected the credentials of your provider connection'
    );
  });

  it('does not reveal the provider or its message for platform routes', () => {
    let auth = classifyUpstreamError(
      apiCallError({ status: 401, body: { error: { message: 'Invalid x-api-key' } } }),
      platform
    );
    let overloaded = classifyUpstreamError(apiCallError({ status: 503 }), platform);

    expect(auth.error.message).toBe('The model provider is temporarily unavailable.');
    expect(overloaded.error.message).not.toContain('Anthropic');
  });

  it('classifies network failures as unreachable', () => {
    for (let error of [
      new TypeError('fetch failed'),
      new Error('connect ECONNREFUSED 127.0.0.1:443')
    ]) {
      let failure = classifyUpstreamError(error, customer);
      expect(failure.error.code).toBe('upstream_unreachable');
      expect(failure.retryable).toBe(true);
    }
  });

  it('classifies anything else as a retryable upstream error', () => {
    let failure = classifyUpstreamError(new Error('Unexpected token < in JSON'), customer);

    expect(failure.error).toMatchObject({ status: 502, code: 'upstream_error' });
    expect(failure.retryable).toBe(true);
  });

  it('falls back to the slug for unknown providers', () => {
    let failure = classifyUpstreamError(apiCallError({ status: 400 }), {
      providerSlug: 'mystery',
      connectionOwner: 'customer'
    });

    expect(failure.error.message).toBe('mystery rejected the request.');
  });
});

describe('toGatewayError', () => {
  it('keeps service errors', () => {
    let error = new ServiceError(
      createError({ status: 403, code: 'forbidden', message: 'No.' })()
    );
    expect(toGatewayError(error)).toEqual({ status: 403, code: 'forbidden', message: 'No.' });
  });

  it('hides anything else behind a 500', () => {
    expect(toGatewayError(new Error('secret detail'))).toEqual({
      status: 500,
      code: 'internal_server_error',
      message: 'An internal error occurred.'
    });
  });
});

describe('connectionUnavailableError', () => {
  it('names the provider only for customer connections', () => {
    expect(connectionUnavailableError(customer).error.message).toBe(
      'The Anthropic connection could not be used.'
    );
    expect(connectionUnavailableError(platform).error.message).toBe(
      'The model provider is temporarily unavailable.'
    );
  });
});
