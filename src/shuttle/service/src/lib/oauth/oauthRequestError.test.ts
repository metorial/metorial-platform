import { ServiceError, badRequestError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import {
  formatOAuthRequestError,
  getOAuthRequestErrorDetails,
  isTransientOAuthStatus
} from './oauthRequestError';

describe('getOAuthRequestErrorDetails', () => {
  it('extracts safe provider diagnostics without retaining response content', () => {
    let details = getOAuthRequestErrorDetails({
      message: 'Request failed for https://private.example/token?secret=value',
      response: {
        status: 400,
        data: {
          error: 'invalid_grant',
          error_description: 'refresh_token=very-secret-value'
        }
      }
    });

    expect(details).toEqual({
      status: 400,
      oauthCode: 'invalid_grant',
      isTransient: false,
      retryAfterMs: null
    });
    expect(JSON.stringify(details)).not.toContain('very-secret-value');
    expect(JSON.stringify(details)).not.toContain('private.example');
  });

  it('bounds Retry-After and classifies transient responses', () => {
    let details = getOAuthRequestErrorDetails({
      response: { status: 429, headers: { 'retry-after': '60' } }
    });

    expect(details.isTransient).toBe(true);
    expect(details.retryAfterMs).toBe(5000);
  });

  it('reads structured service error statuses', () => {
    let details = getOAuthRequestErrorDetails(
      new ServiceError(badRequestError({ message: 'Invalid provider response' }))
    );

    expect(details.status).toBe(400);
    expect(details.isTransient).toBe(false);
  });

  it('rejects response text disguised as an OAuth error code', () => {
    let details = getOAuthRequestErrorDetails({
      response: {
        status: 400,
        data: { error: 'invalid_grant\nrefresh_token=very-secret-value' }
      }
    });

    expect(details.oauthCode).toBeNull();
    expect(JSON.stringify(details)).not.toContain('very-secret-value');
  });
});

describe('isTransientOAuthStatus', () => {
  it('only retries network, throttling and server failures', () => {
    expect(isTransientOAuthStatus(null)).toBe(true);
    expect(isTransientOAuthStatus(429)).toBe(true);
    expect(isTransientOAuthStatus(503)).toBe(true);
    expect(isTransientOAuthStatus(400)).toBe(false);
    expect(isTransientOAuthStatus(403)).toBe(false);
  });
});

describe('formatOAuthRequestError', () => {
  it('only includes the safe status and OAuth code', () => {
    expect(
      formatOAuthRequestError('Token refresh failed', {
        status: 400,
        oauthCode: 'invalid_grant'
      })
    ).toBe('Token refresh failed (HTTP 400, OAuth error invalid_grant)');
  });

  it('uses a safe network fallback', () => {
    expect(
      formatOAuthRequestError('Token refresh failed', { status: null, oauthCode: null })
    ).toBe('Token refresh failed because the OAuth provider could not be reached');
  });
});
