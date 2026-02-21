import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { configSchemaType } from '../../types';

export let v1ProviderConfigSchemaPresenter = Presenter.create(configSchemaType)
  .presenter(async ({ schema }) => ({
    object: 'provider_deployment.config_schema' as const,

    type: 'json_schema' as const,
    schema: schema.
  }))
  .schema(
    v.object({
      object: v.literal('provider_deployment.config_schema', {
        description: "String representing the object's type"
      }),
      schema: v.nullable(
        v.record(v.any(), {
          name: 'schema',
          description: 'JSON Schema for provider configuration',
          examples: [{ type: 'object', properties: { api_key: { type: 'string' } } }]
        })
      )
    })
  )
  .build();
