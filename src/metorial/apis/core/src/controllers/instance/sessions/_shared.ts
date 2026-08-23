import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { normalizeToolFilters as normalizeProviderToolFilters } from '@metorial-subspace/module-provider-internal';

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

export let normalizeToolFilters = (
  toolFilters: ValidationTypeValue<typeof toolFiltersValidator>
): PrismaJson.ToolFilter => normalizeProviderToolFilters(toolFilters);
