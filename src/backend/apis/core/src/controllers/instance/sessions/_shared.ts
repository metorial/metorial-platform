import { v } from '@lowerdeck/validation';

export let toolFilterValidator = v.union([
  v.object({
    type: v.literal('tool_keys'),
    keys: v.array(v.string())
  }),
  v.object({
    type: v.literal('tool_regex'),
    pattern: v.string()
  }),
  v.object({
    type: v.literal('resource_regex'),
    pattern: v.string()
  }),
  v.object({
    type: v.literal('resource_uris'),
    uris: v.array(v.string())
  }),
  v.object({
    type: v.literal('prompt_keys'),
    keys: v.array(v.string())
  }),
  v.object({
    type: v.literal('prompt_regex'),
    pattern: v.string()
  })
]);

export let toolFiltersValidator = v.nullable(
  v.optional(v.union([toolFilterValidator, v.array(toolFilterValidator)]))
);
