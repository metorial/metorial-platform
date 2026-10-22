import { isJsonRpcServerError } from './invocation/report';

let transientOAuthErrorCodes = new Set(['server_error', 'temporarily_unavailable']);

let transientInvocationErrorCodes = new Set([
  'invocation_error',
  'invalid_error_message',
  'no_input_message',
  'no_output_message',
  'no_result'
]);

export let isTransientOAuthRefreshError = (error: { code?: unknown; message?: unknown }) => {
  if (isJsonRpcServerError(error)) return true;

  let values = [error.code, error.message].filter(
    (value): value is string => typeof value === 'string'
  );

  return values.some(
    value => transientOAuthErrorCodes.has(value) || transientInvocationErrorCodes.has(value)
  );
};
