import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { consumerAuthFactorType } from '../types';

export let v1ConsumerAuthFactorPresenter = Presenter.create(consumerAuthFactorType)
  .presenter(async ({ consumerAuthFactor }, opts) => ({
    object: 'consumer.auth_factor',

    id: consumerAuthFactor.id,

    type: {
      email_code: 'email_code',
      sso: 'sso'
    }[consumerAuthFactor.type],
    status: {
      active: 'active',
      inactive: 'inactive'
    }[consumerAuthFactor.status],

    name: consumerAuthFactor.name,
    publicName: consumerAuthFactor.publicName,

    created_at: consumerAuthFactor.createdAt,
    updated_at: consumerAuthFactor.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.auth_factor', {
        name: 'object',
        description: 'Type of the object, fixed as consumer auth factor'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for the consumer auth factor'
      }),

      type: v.enumOf(['email_code', 'sso'], {
        name: 'type',
        description: 'The type of consumer auth factor'
      }),

      status: v.enumOf(['active', 'inactive'], {
        name: 'status',
        description: 'The status of the consumer auth factor'
      }),

      name: v.string({
        name: 'name',
        description: 'The internal name of the consumer auth factor'
      }),

      publicName: v.string({
        name: 'public_name',
        description: 'The public name of the consumer auth factor'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the consumer auth factor was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'The ISO 8601 timestamp when the consumer auth factor was last updated'
      })
    })
  )
  .build();
