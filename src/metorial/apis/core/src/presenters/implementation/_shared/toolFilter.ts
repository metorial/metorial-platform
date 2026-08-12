import { v, ValidationTypeValue } from '@lowerdeck/validation';
import type { ProviderAuthConfig } from '@metorial-subspace/db';

let schema = v.union(
  [
    v.object({
      type: v.literal('allow_all'),
      ignore_parent_filters: v.boolean()
    }),
    v.object({
      type: v.literal('filter'),
      filters: v.array(
        v.union([
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
        ])
      ),
      ignore_parent_filters: v.boolean()
    })
  ],
  { description: 'Tool filter configuration' }
);

export let toolFilterPresenter = Object.assign(
  (filter: ProviderAuthConfig['toolFilter']): ValidationTypeValue<typeof schema> => {
    if (filter.type == 'v1.allow_all') {
      return {
        type: 'allow_all' as const,
        ignore_parent_filters: !!filter.ignoreParentFilters
      };
    }

    if (filter.type == 'v1.filter') {
      return {
        type: 'filter' as const,
        filters: filter.filters,
        ignore_parent_filters: !!filter.ignoreParentFilters
      };
    }

    return filter;
  },
  { schema }
);
