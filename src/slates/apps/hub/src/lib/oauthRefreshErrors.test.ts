import { describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn(), captureMessage: vi.fn() })
}));

import { isTransientOAuthRefreshError } from './oauthRefreshErrors';

describe('isTransientOAuthRefreshError', () => {
  it.each([
    { code: 'server_error', message: 'Provider failed' },
    { code: 'request.bad', message: 'server_error' },
    { code: 'request.bad', message: 'temporarily_unavailable' },
    { code: 'invocation_error', message: 'An error occurred during invocation' },
    { code: 'no_output_message', message: 'Provider did not return a message' },
    { code: -32603, message: 'Internal error' },
    { code: 'request.bad', message: 'Internal Server Error' }
  ])('treats $code / $message as transient', error => {
    expect(isTransientOAuthRefreshError(error)).toBe(true);
  });

  it.each([
    { code: 'unauthorized_client', message: 'unauthorized_client' },
    { code: 'invalid_grant', message: 'Refresh token revoked' },
    { code: 'request.bad', message: 'Slack OAuth error: invalid_refresh_token' },
    { code: 'unknown_error', message: undefined }
  ])('treats $code / $message as permanent', error => {
    expect(isTransientOAuthRefreshError(error)).toBe(false);
  });
});
