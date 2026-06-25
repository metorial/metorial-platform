import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string(),
    SEARCH_DATABASE_URL: v.string(),
    ALGOLIA_APP_ID: v.optional(v.string()),
    ALGOLIA_API_KEY: v.optional(v.string()),
    ALGOLIA_INDEX_PREFIX: v.optional(v.string())
  }
});
