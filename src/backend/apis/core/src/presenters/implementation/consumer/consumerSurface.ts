import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { consumerSurfaceType } from '../../types';

export let v1ConsumerSurfacePresenter = Presenter.create(consumerSurfaceType)
  .presenter(async ({ consumerSurface }) => ({
    object: 'consumer.surface' as const,
    id: consumerSurface.id,
    status: consumerSurface.status,
    name: consumerSurface.name,
    description: consumerSurface.description,
    allow_consumer_skill_authoring: consumerSurface.allowConsumerSkillAuthoring,
    allow_consumer_skill_publishing: consumerSurface.allowConsumerSkillPublishing,
    skill_configuration: {
      id: consumerSurface.skillConfiguration.id,
      is_default: consumerSurface.skillConfiguration.isDefault,
      allow_scripts: consumerSurface.skillConfiguration.allowScripts,
      allowed_file_extensions: consumerSurface.skillConfiguration.allowedFileExtensions,
      allow_non_standard_directories:
        consumerSurface.skillConfiguration.allowNonStandardDirectories
    },

    auth: {
      object: 'consumer.surface.auth' as const,
      session_expiry_time_in_seconds: consumerSurface.sessionExpiryTimeInSeconds,
      email_whitelist: consumerSurface.emailWhitelist
    },

    created_at: consumerSurface.createdAt,
    updated_at: consumerSurface.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.surface'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      allow_consumer_skill_authoring: v.boolean(),
      allow_consumer_skill_publishing: v.boolean(),
      skill_configuration: v.object({
        id: v.string(),
        is_default: v.boolean(),
        allow_scripts: v.boolean(),
        allowed_file_extensions: v.array(v.string()),
        allow_non_standard_directories: v.boolean()
      }),
      auth: v.object({
        object: v.literal('consumer.surface.auth'),
        session_expiry_time_in_seconds: v.number(),
        email_whitelist: v.array(v.string())
      }),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
