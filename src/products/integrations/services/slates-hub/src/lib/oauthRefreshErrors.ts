import { isTransientInvocationError } from './invocationErrors';

let transientOAuthErrorCodePattern = /\b(server_error|temporarily_unavailable)\b/;

// Refresh failures are persisted on the auth config, which blocks every later call (and
// therefore every later refresh attempt) until the user reconnects. Only errors that
// can't resolve on their own should be persisted.
export let isTransientOAuthRefreshError = (error: { code?: unknown; message?: unknown }) => {
  if (isTransientInvocationError(error)) return true;

  // Slates often wrap the provider's OAuth error code in a message,
  // e.g. "Slack OAuth error: server_error".
  return [error.code, error.message].some(
    value => typeof value === 'string' && transientOAuthErrorCodePattern.test(value)
  );
};
