import { checkEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';
import { objectStorageUrl, redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    ORIGIN_SERVICE_PUBLIC_URL: v.string(),

    ORIGIN_API_PORT: v.optional(v.number()),
    ORIGIN_SCM_PORT: v.optional(v.number())
  },

  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    CODE_BUCKET_OBJECT_STORAGE_BUCKET: v.string()
  },

  codeBucket: {
    CODE_BUCKET_SERVICE_URL: v.string(),
    CODE_BUCKET_EDITOR_URL: v.string()
  },

  gh: {
    SCM_GITHUB_APP_ID: setting(v.optional(v.string()), { editions: ['cloud'] }),
    SCM_GITHUB_APP_SLUG: setting(v.optional(v.string()), { editions: ['cloud'] }),
    SCM_GITHUB_APP_PRIVATE_KEY_BASE_64: setting(v.optional(v.string()), {
      editions: ['cloud']
    }),
    SCM_GITHUB_APP_CLIENT_ID: setting(v.optional(v.string()), { editions: ['cloud'] }),
    SCM_GITHUB_APP_CLIENT_SECRET: setting(v.optional(v.string()), { editions: ['cloud'] }),
    SCM_GITHUB_APP_WEBHOOK_SECRET: setting(v.optional(v.string()), { editions: ['cloud'] })
  },

  gl: {
    SCM_GITLAB_CLIENT_ID: setting(v.optional(v.string()), { editions: ['cloud'] }),
    SCM_GITLAB_CLIENT_SECRET: setting(v.optional(v.string()), { editions: ['cloud'] })
  },

  bb: {
    SCM_BITBUCKET_CLIENT_ID: setting(v.optional(v.string()), { editions: ['cloud'] }),
    SCM_BITBUCKET_CLIENT_SECRET: setting(v.optional(v.string()), { editions: ['cloud'] })
  }
});

export let SCM_GITHUB_APP_PRIVATE_KEY =
  checkEdition('cloud') && env.gh.SCM_GITHUB_APP_PRIVATE_KEY_BASE_64
    ? atob(env.gh.SCM_GITHUB_APP_PRIVATE_KEY_BASE_64)
    : undefined;
