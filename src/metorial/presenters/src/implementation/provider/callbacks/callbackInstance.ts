import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackInstanceType } from '../../../types';
import { callbackSyncPresenter } from './callback';

export let v1CallbackInstancePresenter = Presenter.create(callbackInstanceType)
  .presenter(async ({ callbackInstance }) => ({
    object: 'callback.instance' as const,

    id: callbackInstance.id,
    status: callbackInstance.status,

    callback_id: callbackInstance.callback.id,
    integration_instance_id: callbackInstance.integrationInstance.id,
    integration_instance_provider_id: callbackInstance.integrationInstanceProvider.id,

    created_at: callbackInstance.createdAt,
    updated_at: callbackInstance.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.instance', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique callback instance identifier',
        examples: ['cbi_5gHjKlMnPqRsTuVw']
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description:
          'Callback instance lifecycle status. Archived once the callback or the integration instance provider goes away.'
      }),

      callback_id: v.string({
        name: 'callback_id',
        description: 'Callback this instance belongs to',
        examples: ['cbk_4dEfGhJkLmNpQrSt']
      }),

      integration_instance_id: v.string({
        name: 'integration_instance_id',
        description: 'Integration instance this callback instance listens for',
        examples: ['ini_6hJkLmNpQrStUvWx']
      }),

      integration_instance_provider_id: v.string({
        name: 'integration_instance_provider_id',
        description: 'Integration instance provider this callback instance is registered on',
        examples: ['iip_7jKlMnPqRsTuVwXy']
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback instance was created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the callback instance was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();

export let dashboardCallbackInstancePresenter = Presenter.create(callbackInstanceType)
  .presenter(async ({ callbackInstance }, opts) => {
    let inner = await v1CallbackInstancePresenter.present({ callbackInstance }, opts).run();

    return {
      ...inner,
      sync: callbackSyncPresenter(callbackInstance)
    };
  })
  .schema(
    v.object({
      ...v1CallbackInstancePresenter.schema.properties,
      sync: callbackSyncPresenter.schema
    }) as any
  )
  .build();
