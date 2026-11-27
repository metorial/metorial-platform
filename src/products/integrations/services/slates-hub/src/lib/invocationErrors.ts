import { isJsonRpcServerError } from './invocation/report';

let transientInvocationErrorCodes = new Set([
  'invocation_error',
  'invalid_error_message',
  'no_input_message',
  'no_output_message',
  'no_result'
]);

// Failures of the runtime or the invocation transport rather than of the slate's own logic. They
// resolve without the user changing anything, so they must never be persisted as a broken state.
export let isTransientInvocationError = (error: { code?: unknown; message?: unknown }) => {
  if (isJsonRpcServerError(error)) return true;

  return typeof error.code === 'string' && transientInvocationErrorCodes.has(error.code);
};
