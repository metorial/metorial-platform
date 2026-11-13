import { createError } from '@lowerdeck/error';

export let tooManyItemsError = createError({
  status: 413,
  code: 'too_many_items',
  message: 'The request contains too many items.',
  hint: 'Send smaller batches.'
});
