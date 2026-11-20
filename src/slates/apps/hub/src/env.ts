import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';
import {
  metorialEnv,
  metorialRegion,
  objectStorageUrl,
  redisUrl,
  serviceUrl
} from '@metorial/shared-settings';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    SERVICE_PUBLIC_URL: v.string(),
    METORIAL_ENV: metorialEnv,
    METORIAL_REGION: metorialRegion,
    METORIAL_API_URL: v.optional(v.string()),

    SLATES_HUB_PUBLIC_PORT: v.optional(v.number()),
    SLATES_HUB_INTERNAL_PORT: v.optional(v.number()),
    SLATES_HUB_ADMIN_PORT: v.optional(v.number()),
    SLATES_HUB_LIVE_PORT: setting(v.optional(v.number()), {
      description:
        'Port of a listener that serves only the live invocation API, for runtimes that may reach nothing else on the hub; off when unset'
    })
  },

  functionBay: {
    FUNCTION_BAY_API_URL: serviceUrl('functionBay'),
    FUNCTION_BAY_TENANT_IDENTIFIER: v.string(),

    FUNCTION_BAY_DEFAULT_MEMORY_MB: v.number(),
    FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS: v.number(),

    SLATE_DEPLOYMENT_TIMEOUT_MINUTES: setting(v.number(), {
      default: 75,
      description:
        'Minutes after which a pending or running slate deployment is marked failed; keep it above the build timeout of the runtime'
    })
  },

  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    INVOCATIONS_BUCKET_NAME: v.string(),
    MAX_ATTACHMENT_SIZE_BYTES: v.optional(v.number()),
    SLATES_LIVE_INVOCATION_ENABLED: setting(v.boolean(), {
      description:
        'Lets slates upload large attachments straight to object storage during an invocation; off on-prem, where function pods cannot reach the public upload URL',
      default: perEdition({ cloud: true, 'on-prem': false })
    }),
    SLATES_LIVE_UPLOAD_MODE: setting(v.enumOf(['single', 'multipart']), {
      description:
        'How slates upload attachments during an invocation: one signed PUT per attachment, or signed parts whose sizes object storage enforces. Multipart needs object storage multipart uploads and is only offered to slates that support it',
      default: perEdition<'single' | 'multipart'>({ cloud: 'single', 'on-prem': 'multipart' })
    }),
    SLATES_LIVE_INVOCATION_BASE_URL: setting(v.optional(v.string({ modifiers: [v.url()] })), {
      description:
        'Base URL slates call the live invocation API on; SERVICE_PUBLIC_URL when unset'
    }),
    SLATES_LIVE_UPLOAD_BASE_URL: setting(v.optional(v.string({ modifiers: [v.url()] })), {
      description:
        "Base URL that signed upload URLs handed to slates are moved onto, for runtimes that reach object storage's public listener under another address"
    }),
    SLATES_LIVE_INVOCATION_PLATFORM_ROUTES: setting.list(v.string(), {
      default: [],
      description:
        'Function Bay platform routes requested for invocations that get a live invocation token, so the runtime can reach the live API and upload URLs'
    })
  },

  encryption: {
    ENCRYPTION_KEY: v.string()
  },

  registry: {
    INITIAL_REGISTRIES: v.optional(v.string()),
    SLATES_REGISTRY_URL: v.optional(v.string()),
    SLATES_SUB_REGISTRY_ID: v.optional(v.string()),
    SUPPORTS_PREBUILT_SLATES: v.optional(v.boolean()),
    // npm registry for slate deployment installs; npm's default when unset.
    SLATE_DEPLOYMENT_NPM_REGISTRY_URL: v.optional(v.string()),
    SLATES_RUNTIME_VERSION: setting(v.optional(v.string()), {
      description:
        'Pins the slates runtime bundled into prebuilt slate deployments; the newest compatible version from the registry when unset'
    })
  },

  ares: {
    ARES_AUTH_URL: v.optional(v.string()),
    ARES_INTERNAL_URL: v.optional(v.string()),
    SLATES_ADMIN_ALLOWED_EMAIL_DOMAINS: v.optional(v.string())
  },

  slates: {
    SLATES_HUB_INSTANCE_IDENTIFIER: v.string(),
    SLATES_WEBHOOK_SYNC_TIMEOUT_MS: v.optional(v.number()),
    SLATES_WEBHOOK_TRIGGER_HOST: v.optional(v.string())
  },

  nebula: {
    NEBULA_API_URL: serviceUrl('nebula'),
    NEBULA_CONSUMER_IDENTIFIER: v.string(),
    NEBULA_CONSUMER_TOKEN: v.string()
  },

  secrets: {
    SLATES_DELEGATE_SECRETS_TO_NEBULA: v.boolean(),
    SLATE_ATTACHMENT_SIGNING_SECRET: v.string(),
    TOOL_ATTACHMENT_ROUTER_SECRET: v.optional(v.string())
  },

  subspace: {
    SUBSPACE_INTERNAL_URL: v.optional(v.string())
  }
});
