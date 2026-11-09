import { checkEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';
import { objectStorageUrl, redisUrl, serviceUrl } from '@metorial/shared-settings';
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
    CODE_BUCKET_OBJECT_STORAGE_BUCKET: v.string(),
    FILES_BUCKET_NAME: setting(v.optional(v.string()), {
      description: 'Metorial files bucket, the default manifest source bucket'
    })
  },

  manifestSync: {
    ORIGIN_MANIFEST_SYNC_ENABLED: setting(v.boolean(), {
      default: true,
      description: 'Accept manifest repository syncs; when off, syncManifest fails retryably'
    }),
    ORIGIN_MANIFEST_SOURCE_BUCKETS: setting.list(v.string(), {
      default: resolved =>
        resolved.storage?.FILES_BUCKET_NAME ? [resolved.storage.FILES_BUCKET_NAME] : [],
      description: 'Object-storage buckets manifests and their content may be read from'
    }),
    ORIGIN_EXPORT_SLICE_SECONDS: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 600,
        description: 'Wall-clock budget of one manifest export invocation'
      }
    ),
    ORIGIN_EXPORT_WRITE_BUDGET: setting(v.number({ modifiers: [v.positive(), v.integer()] }), {
      default: 30,
      description: 'Content-creating provider requests taken from the limiter per export slice'
    }),
    ORIGIN_EXPORT_MAX_NO_PROGRESS_SLICES: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 10,
        description:
          'Consecutive partial export slices without new commits, blobs or LFS uploads before a manifest sync fails with no_progress'
      }
    ),
    ORIGIN_EXPORT_MAX_CONCURRENT_PER_ACCOUNT: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 2,
        description: 'Write-active manifest exports per provider account'
      }
    ),
    ORIGIN_GITHUB_WRITES_PER_MINUTE: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 60,
        description: 'Content-creating GitHub requests per installation per minute'
      }
    ),
    ORIGIN_GITHUB_WRITES_PER_HOUR: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 450,
        description: 'Content-creating GitHub requests per installation per hour'
      }
    ),
    ORIGIN_GITLAB_WRITES_PER_MINUTE: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 60,
        description: 'Content-creating GitLab requests per host and token owner per minute'
      }
    ),
    ORIGIN_GITLAB_WRITES_PER_HOUR: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 1000,
        description: 'Content-creating GitLab requests per host and token owner per hour'
      }
    ),
    ORIGIN_BITBUCKET_WRITES_PER_MINUTE: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 30,
        description:
          'Content-creating Bitbucket requests per workspace or host and user per minute'
      }
    ),
    ORIGIN_BITBUCKET_WRITES_PER_HOUR: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 900,
        description:
          'Content-creating Bitbucket requests per workspace or host and user per hour'
      }
    ),
    ORIGIN_GITHUB_GRAPHQL_MAX_FILE_BYTES: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 16 * 1024 * 1024,
        description: 'Largest file sent inline in a GitHub GraphQL commit batch'
      }
    ),
    ORIGIN_GITHUB_REST_MAX_BLOB_BYTES: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 28 * 1024 * 1024,
        description: 'Largest non-LFS file sent through the GitHub REST blob API'
      }
    ),
    ORIGIN_GITHUB_BATCH_INITIAL_BYTES: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 12 * 1024 * 1024,
        description: 'Starting GitHub commit batch body size'
      }
    ),
    ORIGIN_GITHUB_BATCH_MAX_BYTES: setting(
      v.number({ modifiers: [v.positive(), v.integer()] }),
      {
        default: 28 * 1024 * 1024,
        description: 'Largest GitHub commit batch body size'
      }
    )
  },

  nebula: {
    NEBULA_API_URL: serviceUrl('nebula'),
    NEBULA_CONSUMER_TOKEN: v.string()
  },

  secrets: {
    ORIGIN_DELEGATE_SECRETS_TO_NEBULA: setting(v.boolean(), {
      audience: 'deployment',
      default: false,
      description: 'Store new SCM secrets in Nebula (always enabled in the on-prem edition)'
    })
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

export let delegateSecretsToNebula =
  checkEdition('on-prem') || env.secrets.ORIGIN_DELEGATE_SECRETS_TO_NEBULA;

export let SCM_GITHUB_APP_PRIVATE_KEY =
  checkEdition('cloud') && env.gh.SCM_GITHUB_APP_PRIVATE_KEY_BASE_64
    ? atob(env.gh.SCM_GITHUB_APP_PRIVATE_KEY_BASE_64)
    : undefined;
