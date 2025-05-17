import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  meiliSearch: {
    MEILISEARCH_HOST: v.string(),
    MEILISEARCH_API_KEY: v.optional(v.string())
  }
});
