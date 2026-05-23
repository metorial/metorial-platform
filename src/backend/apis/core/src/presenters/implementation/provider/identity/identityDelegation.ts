import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { identityDelegationType } from '../../../types';
import { v1IdentityActorPresenter } from './identityActor';

let identityDelegationCredentialOverrideSchema = v.object({
  object: v.literal('identity.delegation_credential_override', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Unique credential override identifier.',
    examples: ['idco_9pQrStUvWxYzAbCd']
  }),
  status: v.enumOf(['active', 'expired'], {
    name: 'status',
    description: 'Current status of the credential override.'
  }),
  permissions: v.array(v.enumOf(['provider:call', 'provider:read']), {
    name: 'permissions',
    description: 'Permissions granted for this credential override.',
    examples: [['provider:read', 'provider:call']]
  }),
  credential_id: v.string({
    name: 'credential_id',
    description: 'Credential receiving the override.',
    examples: ['icr_8vBnM4xZa2cDf7gH']
  }),
  created_at: v.date({
    name: 'created_at',
    description: 'Timestamp when the credential override was created.',
    examples: [new Date('2026-02-03T10:15:00Z')]
  }),
  expires_at: v.nullable(
    v.date({
      name: 'expires_at',
      description: 'Timestamp when the credential override expires, if set.',
      examples: [new Date('2026-03-03T10:15:00Z')]
    })
  )
});

let identityDelegationPartySchema = v.object({
  object: v.literal('identity.delegation_party', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Unique delegation party identifier.',
    examples: ['idp_4dEfGhJkLmNpQrSt']
  }),
  roles: v.array(v.enumOf(['owner', 'delegator', 'delegatee']), {
    name: 'roles',
    description: 'Roles this actor has in the delegation.',
    examples: [['owner']]
  }),
  actor: v1IdentityActorPresenter.schema,
  created_at: v.date({
    name: 'created_at',
    description: 'Timestamp when the party was attached to the delegation.',
    examples: [new Date('2026-02-03T10:15:00Z')]
  })
});

let identityDelegationRequestPreviewSchema = v.object({
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
    description: 'Current status of the related delegation request.'
  }),
  denied_reason: v.nullable(
    v.enumOf(['request_denied', 'sub_delegation_depth_exceeded', 'sub_delegation_denied'], {
      name: 'denied_reason',
      description: 'Reason the request was denied, if applicable.'
    })
  ),
  requester: v1IdentityActorPresenter.schema,
  identity_id: v.string({
    name: 'identity_id',
    description: 'Identity targeted by the request.',
    examples: ['idn_5gHjKlMnPqRsTuVw']
  }),
  expires_at: v.date({
    name: 'expires_at',
    description: 'Timestamp when the request expires.',
    examples: [new Date('2026-03-03T10:15:00Z')]
  }),
  created_at: v.date({
    name: 'created_at',
    description: 'Timestamp when the request was created.',
    examples: [new Date('2026-02-03T10:15:00Z')]
  })
});

export let v1IdentityDelegationPresenter = Presenter.create(identityDelegationType)
  .presenter(async ({ identityDelegation }, opts) => ({
    object: 'identity.delegation' as const,

    id: identityDelegation.id,
    status: identityDelegation.status,
    denied_reason: identityDelegation.deniedReason,

    delegation_level: identityDelegation.delegationLevel,
    permissions: identityDelegation.permissions,

    note: identityDelegation.note,
    metadata: identityDelegation.metadata,

    delegation_config_id: identityDelegation.delegationConfigId,

    identity: {
      object: 'identity#preview' as const,

      id: identityDelegation.identity.id,
      name: identityDelegation.identity.name,
      description: identityDelegation.identity.description,
      metadata: identityDelegation.identity.metadata
    },

    parties: await Promise.all(
      identityDelegation.parties.map(async party => ({
        object: 'identity.delegation_party' as const,
        id: party.id,
        roles: party.roles,
        actor: await v1IdentityActorPresenter
          .present({ identityActor: party.actor }, opts)
          .run(),
        created_at: party.createdAt
      }))
    ),

    request: identityDelegation.request
      ? {
          object: 'identity.delegation_request' as const,
          id: identityDelegation.request.id,
          status: identityDelegation.request.status,
          denied_reason: identityDelegation.request.deniedReason,
          requester: await v1IdentityActorPresenter
            .present({ identityActor: identityDelegation.request.requester }, opts)
            .run(),
          identity_id: identityDelegation.request.identityId,
          expires_at: identityDelegation.request.expiresAt,
          created_at: identityDelegation.request.createdAt
        }
      : null,

    attestation: identityDelegation.attestation
      ? {
          object: 'identity.delegation_attestation' as const,
          id: identityDelegation.attestation.id,
          type: identityDelegation.attestation.type,
          created_at: identityDelegation.attestation.createdAt
        }
      : null,

    credential_overrides: identityDelegation.credentialOverrides.map(credentialOverride => ({
      object: 'identity.delegation_credential_override' as const,

      id: credentialOverride.id,
      status: credentialOverride.status,

      permissions: credentialOverride.permissions,
      credential_id: credentialOverride.credentialId,

      created_at: credentialOverride.createdAt,
      expires_at: credentialOverride.expiresAt
    })),

    created_at: identityDelegation.createdAt,
    expires_at: identityDelegation.expiresAt,
    revoked_at: identityDelegation.revokedAt
  }))
  .schema(
    v.object({
      object: v.literal('identity.delegation', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique delegation identifier.',
        examples: ['idd_7gHjKlMnPqRsTuVw']
      }),
      status: v.enumOf(['waiting_for_consent', 'denied', 'active', 'revoked', 'expired'], {
        name: 'status',
        description: 'Current status of the delegation.'
      }),
      denied_reason: v.nullable(
        v.enumOf(
          ['request_denied', 'sub_delegation_depth_exceeded', 'sub_delegation_denied'],
          {
            name: 'denied_reason',
            description: 'Reason the delegation was denied, if applicable.'
          }
        )
      ),
      delegation_level: v.number({
        name: 'delegation_level',
        description: 'Depth level of this delegation in the delegation chain.',
        examples: [0]
      }),
      permissions: v.array(v.enumOf(['provider:call', 'provider:read']), {
        name: 'permissions',
        description: 'Permissions granted by this delegation.',
        examples: [['provider:read', 'provider:call']]
      }),
      attestation: v.nullable(
        v.object({
          object: v.literal('identity.delegation_attestation', {
            description: "String representing the object's type"
          }),
          id: v.string({
            name: 'id',
            description: 'Unique attestation identifier.',
            examples: ['ida_3xYzAbCdEfGhIjKl']
          }),
          type: v.enumOf(
            ['api', 'request_approval', 'covered_by_previously_approved_delegation'],
            {
              name: 'type',
              description: 'Type of attestation, if any.'
            }
          ),
          created_at: v.date({
            name: 'created_at',
            description: 'Timestamp when the attestation was created.',
            examples: [new Date('2026-02-03T10:15:00Z')]
          })
        })
      ),
      note: v.nullable(
        v.string({
          name: 'note',
          description: 'Optional note explaining the delegation.',
          examples: ['Temporary support access for incident triage']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Additional metadata associated with the delegation.',
          examples: [{ incident: 'INC-2048', requested_by: 'support' }]
        })
      ),
      identity: v.object({
        object: v.literal('identity#preview', {
          description: "String representing the identity object's type"
        }),
        id: v.string({
          name: 'id',
          description: 'Unique identity identifier.',
          examples: ['idn_5gHjKlMnPqRsTuVw']
        }),
        name: v.string({
          name: 'name',
          description: 'Display name of the identity.',
          examples: ['Jane Doe']
        }),
        description: v.string({
          name: 'description',
          description: 'Optional description of the identity.',
          examples: ['Customer support engineer']
        }),
        metadata: v.nullable(
          v.record(v.any(), {
            name: 'metadata',
            description: 'Additional metadata associated with the identity.'
          })
        )
      }),
      delegation_config_id: v.nullable(
        v.string({
          name: 'delegation_config_id',
          description: 'Delegation config used to evaluate this delegation.',
          examples: ['idc_2mNpQrStUvWxYzAb']
        })
      ),
      parties: v.array(identityDelegationPartySchema, {
        name: 'parties',
        description: 'Actors involved in the delegation and their roles.'
      }),
      request: v.nullable(identityDelegationRequestPreviewSchema),
      credential_overrides: v.array(identityDelegationCredentialOverrideSchema, {
        name: 'credential_overrides',
        description: 'Per-credential permission overrides attached to the delegation.'
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the delegation was created.',
        examples: [new Date('2026-02-03T10:15:00Z')]
      }),
      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: 'Timestamp when the delegation expires, if set.',
          examples: [new Date('2026-03-03T10:15:00Z')]
        })
      ),
      revoked_at: v.nullable(
        v.date({
          name: 'revoked_at',
          description: 'Timestamp when the delegation was revoked, if revoked.',
          examples: [new Date('2026-02-12T17:45:00Z')]
        })
      )
    })
  )
  .build();
