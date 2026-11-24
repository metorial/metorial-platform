import { createError } from '@lowerdeck/error';

export let modelNotFoundError = createError({
  status: 404,
  code: 'model_not_found',
  message: 'The requested model does not exist.',
  hint: 'Use a unified model id like "anthropic/claude-sonnet-4.5", or pin a provider like "openai:gpt-4o".'
});

export let modelNotAllowedError = createError({
  status: 403,
  code: 'model_not_allowed',
  message: 'This gateway token is not allowed to use the requested model.'
});

export let modelUnavailableError = createError({
  status: 404,
  code: 'model_unavailable',
  message: 'No provider is available to serve the requested model.',
  hint: 'Connect a provider that offers this model, or use a model the metorial provider supports.'
});
