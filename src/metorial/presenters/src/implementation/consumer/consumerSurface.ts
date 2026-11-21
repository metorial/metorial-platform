import { v } from '@lowerdeck/validation';
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
      object: v.literal('consumer.surface', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once the surface is archived.'
      }),
      name: v.string({ description: 'Display name.' }),
      description: v.nullable(v.string({ description: 'Free-text description.' })),
      allow_consumer_skill_authoring: v.boolean({
        description: 'Consumers can author skills on this surface.'
      }),
      allow_consumer_skill_publishing: v.boolean({
        description: 'Consumers can publish skills from this surface.'
      }),
      skill_configuration: v.object(
        {
          id: v.string({ description: 'Unique ID.' }),
          is_default: v.boolean({
            description: 'Used when the surface has no skill configuration of its own.'
          }),
          allow_scripts: v.boolean({
            description: 'Skills on this surface can run scripts.'
          }),
          allowed_file_extensions: v.array(v.string(), {
            description: 'File extensions skills on this surface can use.'
          }),
          allow_non_standard_directories: v.boolean({
            description: 'Skills on this surface can use directories outside the standard ones.'
          })
        },
        {
          name: 'skill_configuration',
          description: 'Skill rules applied to this surface.'
        }
      ),
      auth: v.object(
        {
          object: v.literal('consumer.surface.auth', {
            description: 'String representing the object’s type.'
          }),
          session_expiry_time_in_seconds: v.number({
            description: 'Consumer session lifetime in seconds.'
          }),
          email_whitelist: v.array(v.string(), {
            description: 'Email addresses and domains allowed to sign in on this surface.',
            examples: [['ada@example.com', '*@example.com']]
          })
        },
        {
          name: 'auth',
          description: 'How consumers sign in to this surface.'
        }
      ),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();
