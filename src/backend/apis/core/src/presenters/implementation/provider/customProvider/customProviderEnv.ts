import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderEnvType } from '../../../types';

export let v1CustomProviderEnvPresenter = Presenter.create(customProviderEnvType)
  .presenter(async ({ customProviderFrom }, opts) => ({
    object: 'custom_provider.env' as const,

    env: customProviderFrom?.type === 'function' ? customProviderFrom.env : null
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.env', {
        description: "String representing the object's type"
      }),
      env: v.nullable(
        v.record(v.any(), {
          description: 'Key-value pairs representing the custom provider environment variables'
        })
      )
    })
  )
  .build();
