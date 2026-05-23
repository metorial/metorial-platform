import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { authConfigSchemaType } from '../../../types';

export let v1ProviderAuthConfigSchemaPresenter = Presenter.create(authConfigSchemaType)
  .presenter(async ({ schema }) => ({
    object: 'provider.capabilities.auth_config.schema' as const,

    schema: schema.authConfigSchema
      ? { type: 'json_schema' as const, schema: schema.authConfigSchema }
      : null,

    visibility: schema.authConfigVisibility,

    specification_id: schema.specificationId,
    provider_id: schema.providerId,

    created_at: schema.createdAt,
    updated_at: schema.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.capabilities.auth_config.schema', {
        description: "String representing the object's type"
      }),
      schema: v.nullable(
        v.object({
          type: v.literal('json_schema'),
          schema: v.record(v.any(), {
            name: 'schema',
            description: 'JSON Schema for auth config data',
            examples: [{ type: 'object', properties: { access_token: { type: 'string' } } }]
          })
        })
      ),
      visibility: v.enumOf(['encrypted'], {
        name: 'visibility',
        description: 'Visibility of the auth config data'
      }),
      specification_id: v.string({
        name: 'specification_id',
        description: 'Specification ID',
        examples: ['psp_9gHjKlMnPqRsTuVw']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
