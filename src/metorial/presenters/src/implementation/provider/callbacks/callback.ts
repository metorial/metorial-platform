import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackType } from '../../../types';
import { v1ProviderPreview } from '../provider';

export let callbackSyncPresenter = Object.assign(
  (callback: {
    syncStatus: string;
    lastSyncErrorCode: string | null;
    lastSyncErrorMessage: string | null;
    lastSyncedAt: Date | null;
  }) => ({
    object: 'callback.sync' as const,
    status: callback.syncStatus,
    error: callback.lastSyncErrorCode
      ? {
          object: 'callback.sync.error' as const,
          code: callback.lastSyncErrorCode,
          message: callback.lastSyncErrorMessage
        }
      : null,
    synced_at: callback.lastSyncedAt
  }),
  {
    schema: v.object(
      {
        object: v.literal('callback.sync', {
          description: "String representing the object's type"
        }),

        status: v.enumOf(['pending', 'synced', 'failed'], {
          name: 'status',
          description:
            'Whether the callback has been registered with the provider yet. Nothing is delivered until this is synced.'
        }),

        error: v.nullable(
          v.object(
            {
              object: v.literal('callback.sync.error', {
                description: "String representing the object's type"
              }),

              code: v.string({
                name: 'code',
                description: 'Machine-readable reason the last registration attempt failed',
                examples: ['callbacks_not_supported']
              }),

              message: v.nullable(
                v.string({
                  name: 'message',
                  description: 'Human-readable reason the last registration attempt failed',
                  examples: ['This provider does not support callbacks.']
                })
              )
            },
            {
              name: 'error',
              description: 'The last registration failure, cleared once the callback syncs'
            }
          )
        ),

        synced_at: v.nullable(
          v.date({
            name: 'synced_at',
            description: 'Timestamp when the callback was last successfully registered',
            examples: [new Date('2026-01-10T14:45:00Z')]
          })
        )
      },
      {
        name: 'sync',
        description: 'Registration state of this callback with the provider'
      }
    )
  }
);

export let v1CallbackPresenter = Presenter.create(callbackType)
  .presenter(async ({ callback }) => ({
    object: 'callback' as const,

    id: callback.id,
    status: callback.status,

    name: callback.name,
    description: callback.description,
    metadata: callback.metadata,

    integration_id: callback.integration.id,
    integration_provider_id: callback.integrationProvider.id,

    provider: v1ProviderPreview(callback.provider),

    created_at: callback.createdAt,
    updated_at: callback.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('callback', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique callback identifier',
        examples: ['cbk_4dEfGhJkLmNpQrSt']
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description:
          'Callback lifecycle status. Archived once callbacks are disabled on the integration provider.'
      }),

      name: v.string({
        name: 'name',
        description: 'Display name for the callback',
        examples: ['Production GitHub Events']
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Optional callback description',
          examples: ['Repository events for the production workspace']
        })
      ),

      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional callback metadata',
          examples: [{ environment: 'production', owner: 'platform-team' }]
        })
      ),

      integration_id: v.string({
        name: 'integration_id',
        description: 'Integration this callback belongs to',
        examples: ['int_2bCdEfGhJkLmNpQr']
      }),

      integration_provider_id: v.string({
        name: 'integration_provider_id',
        description: 'Integration provider this callback was created for',
        examples: ['inp_3cDeFgHjKlMnPqRs']
      }),

      provider: v1ProviderPreview.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback was created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the callback was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();

export let dashboardCallbackPresenter = Presenter.create(callbackType)
  .presenter(async ({ callback }, opts) => {
    let inner = await v1CallbackPresenter.present({ callback }, opts).run();

    return {
      ...inner,
      sync: callbackSyncPresenter(callback)
    };
  })
  .schema(
    v.object({
      ...v1CallbackPresenter.schema.properties,
      sync: callbackSyncPresenter.schema
    }) as any
  )
  .build();
