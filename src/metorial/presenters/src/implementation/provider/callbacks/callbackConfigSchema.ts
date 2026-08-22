import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackConfigSchemaType } from '../../../types';

export let v1CallbackConfigSchemaPresenter = Presenter.create(callbackConfigSchemaType)
  .presenter(async ({ schema }) => ({
    object: 'callback.config_schema' as const,
    schema
  }))
  .schema(
    v.object({
      object: v.literal('callback.config_schema', {
        description: "String representing the object's type"
      }),
      schema: v.nullable(
        v.record(v.any(), {
          name: 'schema',
          description: 'JSON Schema for callback-specific configuration values'
        })
      )
    })
  )
  .build();
