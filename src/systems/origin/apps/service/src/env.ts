import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string(),

    ORIGIN_SERVICE_PUBLIC_URL: v.string()
  },

  codeBucket: {
    CODE_BUCKET_SERVICE_URL: v.string(),
    CODE_BUCKET_EDITOR_URL: v.string()
  },

  gh: {
    SCM_GITHUB_APP_ID: v.optional(v.string()),
    SCM_GITHUB_APP_SLUG: v.optional(v.string()),
    SCM_GITHUB_APP_PRIVATE_KEY_BASE_64: v.optional(v.string()),
    SCM_GITHUB_APP_CLIENT_ID: v.optional(v.string()),
    SCM_GITHUB_APP_CLIENT_SECRET: v.optional(v.string())
  },

  gl: {
    SCM_GITLAB_CLIENT_ID: v.optional(v.string()),
    SCM_GITLAB_CLIENT_SECRET: v.optional(v.string())
  }
});

export let SCM_GITHUB_APP_PRIVATE_KEY = env.gh.SCM_GITHUB_APP_PRIVATE_KEY_BASE_64
  ? atob(env.gh.SCM_GITHUB_APP_PRIVATE_KEY_BASE_64)
  : undefined;
