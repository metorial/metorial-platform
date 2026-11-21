import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { identityType } from '../../../types';
import { v1IdentityActorPresenter } from './identityActor';
import { v1IdentityCredentialPresenter } from './identityCredential';

export let v1IdentityPresenter = Presenter.create(identityType)
  .presenter(async ({ identity }, opts) => ({
    object: 'identity' as const,

    id: identity.id,
    status: identity.status,

    name: identity.name,
    description: identity.description,
    metadata: identity.metadata,

    owner: {
      type: 'actor' as const,
      actor: await v1IdentityActorPresenter
        .present({ identityActor: identity.actor }, opts)
        .run()
    },

    credentials: await Promise.all(
      identity.credentials.map(identityCredential =>
        v1IdentityCredentialPresenter.present({ identityCredential }, opts).run()
      )
    ),

    delegation_config_id: identity.delegationConfig?.id ?? null,

    created_at: identity.createdAt,
    updated_at: identity.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('identity', { description: 'String representing the object’s type.' }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['idn_5gHjKlMnPqRsTuVw']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description:
          'Current lifecycle status of the identity. `archived` once you archive the identity.'
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name.',
          examples: ['Production GitHub Identity']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Identity used by the release pipeline']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
          examples: [{ environment: 'production', owner: 'platform' }]
        })
      ),
      owner: v.object(
        {
          type: v.literal('actor', {
            name: 'type',
            description: 'Owner type for the identity.'
          }),
          actor: v1IdentityActorPresenter.schema
        },
        {
          description: 'Actor that owns the identity.'
        }
      ),
      credentials: v.array(v1IdentityCredentialPresenter.schema, {
        name: 'credentials',
        description: 'Credentials currently attached to the identity.'
      }),
      delegation_config_id: v.nullable(
        v.string({
          name: 'delegation_config_id',
          description:
            'Default delegation config applied to the identity. `null` when none is set.',
          examples: ['idc_2mNpQrStUvWxYzAb']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2026-02-03T10:15:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-02-10T14:30:00Z')]
      })
    })
  )
  .build();
