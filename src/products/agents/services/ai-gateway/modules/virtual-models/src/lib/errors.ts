import { createError } from '@lowerdeck/error';

export let invalidVirtualModelError = createError({
  status: 400,
  code: 'invalid_virtual_model',
  message: 'The virtual model definition is invalid.'
});

export let virtualModelSlugTakenError = createError({
  status: 409,
  code: 'virtual_model_slug_taken',
  message: 'A virtual model with this slug already exists in the instance.'
});

export let decisionFailedError = createError({
  status: 502,
  code: 'decision_failed',
  message: 'The decision model could not classify the request.',
  hint: 'Set the virtual model\'s decision.on_error to "default" to fall back to its default models.'
});

export let noCompatibleTargetError = createError({
  status: 422,
  code: 'no_compatible_model',
  message: 'None of the models this request was routed to can handle it.',
  hint: 'Add a model with the required capabilities (images, tools, context size) to the matching rule or the default.'
});
