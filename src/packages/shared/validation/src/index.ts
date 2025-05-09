// export * from './lib/result';
// export * from './lib/validator';
// export * from './modifiers';
// export * from './transformers';
// export * from './validators';

export * from './lib/introspect';
export * from './lib/types';

import * as introspect from './lib/introspect';
import * as result from './lib/result';
import * as validator from './lib/validator';
import * as modifiers from './modifiers';
import * as transformers from './transformers';
import * as validators from './validators';

export default {
  ...modifiers,
  ...introspect,
  ...transformers,
  ...validators,
  ...result,
  ...validator
};

export let v = {
  ...modifiers,
  ...introspect,
  ...transformers,
  ...validators,
  ...result,
  ...validator
};
