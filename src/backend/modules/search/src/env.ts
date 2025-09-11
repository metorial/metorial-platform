import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  meiliSearch: {
    MEILISEARCH_HOST: v.optional(v.string()),
    MEILISEARCH_API_KEY: v.optional(v.string()),
    MEILISEARCH_INDEX_PREFIX: v.optional(v.string())
  },

  openSearch: {
    OPENSEARCH_HOST: v.optional(v.string()),
    OPENSEARCH_USERNAME: v.optional(v.string()),
    OPENSEARCH_PASSWORD: v.optional(v.string()),
    OPENSEARCH_INDEX_PREFIX: v.optional(v.string()),
    OPENSEARCH_PROTOCOL: v.optional(v.string())
  }
});
