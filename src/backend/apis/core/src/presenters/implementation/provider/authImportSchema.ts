import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { authImportSchemaType } from '../../types';

export let v1AuthImportSchemaPresenter = Presenter.create(authImportSchemaType)
  .presenter(async ({ schema }) => ({
    object: 'provider_auth_config.import_schema' as const,
    schema: schema.schema
  }))
  .schema(
    v.object({
      object: v.literal('provider_auth_config.import_schema', {
        description: "String representing the object's type"
      }),
      schema: v.nullable(
        v.record(v.any(), {
          name: 'schema',
          description: 'JSON Schema for auth import data',
          examples: [{ type: 'object', properties: { access_token: { type: 'string' } } }]
        })
      )
    })
  )
  .build();
