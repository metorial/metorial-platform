import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { identityType } from '../../types';
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
        .present({ identityActor: identity.owner.actor }, opts)
        .run()
    },

    credentials: await Promise.all(
      identity.credentials.map(identityCredential =>
        v1IdentityCredentialPresenter.present({ identityCredential }, opts).run()
      )
    ),

    delegation_config_id: identity.delegationConfigId,

    created_at: identity.createdAt,
    updated_at: identity.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('identity', { description: "String representing the object's type" }),
      id: v.string({
        name: 'id',
        description: 'Unique identity identifier.',
        examples: ['idn_5gHjKlMnPqRsTuVw']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Current lifecycle status of the identity.'
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Human-readable name of the identity.',
          examples: ['Production GitHub Identity']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Optional description of what the identity is used for.',
          examples: ['Identity used by the release pipeline']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Additional metadata associated with the identity.',
          examples: [{ environment: 'production', owner: 'platform' }]
        })
      ),
      owner: v.object({
        type: v.literal('actor', {
          name: 'type',
          description: 'Owner type for the identity.'
        }),
        actor: v1IdentityActorPresenter.schema
      }),
      credentials: v.array(v1IdentityCredentialPresenter.schema, {
        name: 'credentials',
        description: 'Credentials currently attached to the identity.'
      }),
      delegation_config_id: v.nullable(
        v.string({
          name: 'delegation_config_id',
          description: 'Default delegation config applied to the identity.',
          examples: ['idc_2mNpQrStUvWxYzAb']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the identity was created.',
        examples: [new Date('2026-02-03T10:15:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the identity was last updated.',
        examples: [new Date('2026-02-10T14:30:00Z')]
      })
    })
  )
  .build();
