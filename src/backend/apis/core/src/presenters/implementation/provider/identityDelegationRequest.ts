import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { identityDelegationRequestType } from '../../types';
import { v1IdentityActorPresenter } from './identityActor';
import { v1IdentityDelegationPresenter } from './identityDelegation';

export let v1IdentityDelegationRequestPresenter = Presenter.create(
  identityDelegationRequestType
)
  .presenter(async ({ identityDelegationRequest }, opts) => ({
    object: 'identity.delegation_request' as const,

    id: identityDelegationRequest.id,
    status: identityDelegationRequest.status,
    denied_reason: identityDelegationRequest.deniedReason,

    identity_id: identityDelegationRequest.identityId,

    requester: await v1IdentityActorPresenter
      .present({ identityActor: identityDelegationRequest.requester }, opts)
      .run(),

    delegation: await v1IdentityDelegationPresenter
      .present({ identityDelegation: identityDelegationRequest.delegation }, opts)
      .run(),

    expires_at: identityDelegationRequest.expiresAt,
    created_at: identityDelegationRequest.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('identity.delegation_request', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique delegation request identifier.',
        examples: ['idr_2mNpQrStUvWxYzAb']
      }),
      status: v.enumOf(['pending', 'approved', 'denied', 'canceled'], {
        name: 'status',
        description: 'Current status of the delegation request.'
      }),
      denied_reason: v.nullable(
        v.enumOf(
          ['request_denied', 'sub_delegation_depth_exceeded', 'sub_delegation_denied'],
          {
            name: 'denied_reason',
            description: 'Reason the request ultimately resulted in a denied delegation.'
          }
        )
      ),
      requester: v1IdentityActorPresenter.schema,
      identity_id: v.string({
        name: 'identity_id',
        description: 'Identity targeted by the delegation request.',
        examples: ['idn_5gHjKlMnPqRsTuVw']
      }),
      delegation: v1IdentityDelegationPresenter.schema,
      expires_at: v.date({
        name: 'expires_at',
        description: 'Timestamp when the delegation request expires.',
        examples: [new Date('2026-03-03T10:15:00Z')]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the delegation request was created.',
        examples: [new Date('2026-02-03T10:15:00Z')]
      })
    })
  )
  .build();
