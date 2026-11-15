import { describe, expect, it } from 'vitest';
import { ConnectionError, HttpResponseError } from './connectionError';
import { isExpectedConnectionFailure } from './connectionIssues';

describe('isExpectedConnectionFailure', () => {
  it.each([
    ['connection error', new ConnectionError({ code: 'auth_token_refresh_failed', message: 'x' })],
    ['http response error', new HttpResponseError(502, 'Bad Gateway', '')],
    ['refused socket', Object.assign(new Error('boom'), { code: 'ECONNREFUSED' })],
    ['undici error', Object.assign(new Error('boom'), { code: 'UND_ERR_SOCKET' })],
    ['fetch failure', new TypeError('fetch failed')],
    ['abort', Object.assign(new Error('x'), { name: 'AbortError' })]
  ])('treats %s as expected', (_, error) => {
    expect(isExpectedConnectionFailure(error)).toBe(true);
  });

  it.each([
    ['type error', new TypeError("Cannot read properties of undefined (reading 'id')")],
    ['plain error', new Error('Unexpected state in bridge')]
  ])('treats %s as our problem', (_, error) => {
    expect(isExpectedConnectionFailure(error)).toBe(false);
  });
});
