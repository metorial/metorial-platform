import { isJsonRpcServerError } from './invocation/report';

let transientOAuthErrorCodePattern = /\b(server_error|temporarily_unavailable)\b/;

let transientInvocationErrorCodes = new Set([
  'invocation_error',
  'invalid_error_message',
  'no_input_message',
  'no_output_message',
  'no_result'
]);

// Refresh failures are persisted on the auth config, which blocks every later call (and
// therefore every later refresh attempt) until the user reconnects. Only errors that
// can't resolve on their own should be persisted.
export let isTransientOAuthRefreshError = (error: { code?: unknown; message?: unknown }) => {
  if (isJsonRpcServerError(error)) return true;
  if (typeof error.code === 'string' && transientInvocationErrorCodes.has(error.code)) {
    return true;
  }

  // Slates often wrap the provider's OAuth error code in a message,
  // e.g. "Slack OAuth error: server_error".
  return [error.code, error.message].some(
    value => typeof value === 'string' && transientOAuthErrorCodePattern.test(value)
  );
};
