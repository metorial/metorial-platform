import { describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn(), captureMessage: vi.fn() })
}));

import { isTransientInvocationError } from './invocationErrors';

describe('isTransientInvocationError', () => {
  it.each([
    { code: 'invocation_error', message: 'An error occurred during invocation' },
    { code: 'no_output_message', message: 'Provider did not return a message' },
    { code: 'no_result', message: undefined },
    { code: -32603, message: 'Internal error' },
    { code: 'request.bad', message: 'Internal Server Error' }
  ])('treats $code / $message as transient', error => {
    expect(isTransientInvocationError(error)).toBe(true);
  });

  it.each([
    { code: 'invalid_config', message: 'The provided configuration is invalid' },
    { code: 'request.bad', message: 'Slack OAuth error: server_error' },
    { code: 'request.bad', message: 'Mentions invocation_error in passing' },
    { code: 'unknown_error', message: undefined }
  ])('treats $code / $message as permanent', error => {
    expect(isTransientInvocationError(error)).toBe(false);
  });
});
