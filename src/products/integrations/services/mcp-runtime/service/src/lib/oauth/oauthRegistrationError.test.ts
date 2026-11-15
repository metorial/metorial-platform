import { describe, expect, it } from 'vitest';
import { getOAuthRegistrationErrorDetails } from './oauthRegistrationError';

describe('getOAuthRegistrationErrorDetails', () => {
  it('retains provider diagnostics and redacts sensitive response fields', () => {
    let details = getOAuthRegistrationErrorDetails({
      response: {
        status: 400,
        headers: {
          'content-type': 'application/json',
          'retry-after': '2'
        },
        data: {
          error: 'invalid_client_metadata',
          error_description: 'redirect_uris contains a URI that is not allowed.',
          client_secret: 'do-not-log',
          nested: { access_token: 'also-do-not-log' }
        }
      }
    });

    expect(details).toMatchObject({
      status: 400,
      oauthCode: 'invalid_client_metadata',
      description: 'redirect_uris contains a URI that is not allowed.',
      contentType: 'application/json',
      retryAfterMs: 2000,
      isTransient: false,
      responseTruncated: false
    });
    expect(details.responseText).toContain('redirect_uris contains a URI');
    expect(details.responseText).toContain('[REDACTED]');
    expect(details.responseText).not.toContain('do-not-log');
    expect(details.responseText).not.toContain('also-do-not-log');
  });

  it('truncates oversized provider responses', () => {
    let details = getOAuthRegistrationErrorDetails({
      response: {
        status: 503,
        data: { message: 'x'.repeat(20 * 1024) }
      }
    });

    expect(details.isTransient).toBe(true);
    expect(details.responseTruncated).toBe(true);
    expect(details.responseText.length).toBe(16 * 1024);
    expect(details.response).toBe(details.responseText);
  });
});
