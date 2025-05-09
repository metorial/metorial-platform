import {
  arrayMapper,
  dateMapper,
  objectField,
  objectMapper,
  passthroughMapper,
  unionMapper,
  unionOption
} from './mappers';

export * from './types';

export let mtMap = {
  object: objectMapper,
  objectField,

  union: unionMapper,
  unionOption,

  array: arrayMapper,

  date: dateMapper,

  passthrough: passthroughMapper
};
