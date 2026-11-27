import type { JsonSchema } from './types';

export let getDefaultValues = (schema: JsonSchema) => {
  let defaults: Record<string, unknown> = {};

  if (schema.properties) {
    for (let [key, prop] of Object.entries(schema.properties)) {
      if (prop.default !== undefined) {
        defaults[key] = prop.default;
      }
    }
  }

  return defaults;
};
