import type {
  Agent,
  Identity,
  IdentityActor,
  IdentityCredential,
  IdentityDelegation,
  IdentityDelegationAttestation,
  IdentityDelegationCredentialOverride,
  IdentityDelegationParty,
  IdentityDelegationRequest
} from '@metorial-subspace/db';
import { identityActorPresenter } from './identityActor';

let mapPermissionsFromStorage = (permissions: ('provider_call' | 'provider_read')[]) =>
  permissions.map(
    permission =>
      (
        ({
          provider_call: 'provider:call',
          provider_read: 'provider:read'
        }) as const
      )[permission]
  );

type DelegationPartyWithActor = IdentityDelegationParty & {
  actor: IdentityActor & {
    agent: Agent | null;
  };
};

type DelegationCredentialOverrideWithCredential = IdentityDelegationCredentialOverride & {
  credential: IdentityCredential;
};

type DelegationRequestPreview = IdentityDelegationRequest & {
  requester: IdentityActor & {
    agent: Agent | null;
  };
  identity: Identity;
};

export let identityDelegationCredentialOverridePresenter = (
  credentialOverride: DelegationCredentialOverrideWithCredential
) => ({
  object: 'identity.delegation_credential_override',

  id: credentialOverride.id,
  status: credentialOverride.status,
  permissions: mapPermissionsFromStorage(credentialOverride.permissions),

  credentialId: credentialOverride.credential.id,

  createdAt: credentialOverride.createdAt,
  expiresAt: credentialOverride.expiresAt
});

export let identityDelegationPartyPresenter = (party: DelegationPartyWithActor) => ({
  object: 'identity.delegation_party',

  id: party.id,
  roles: party.roles,
  actor: identityActorPresenter(party.actor),

  createdAt: party.createdAt
});

export let identityDelegationRequestPreviewPresenter = (
  request: DelegationRequestPreview,
  delegation: DelegationWithRelations
) => ({
  object: 'identity.delegation_request',

  id: request.id,
  status: request.status,
  deniedReason: delegation.deniedReason,

  requester: identityActorPresenter(request.requester),
  identityId: request.identity.id,

  expiresAt: request.expiresAt,
  createdAt: request.createdAt
});

type DelegationWithRelations = IdentityDelegation & {
  identity: Identity;
  delegationConfig: { id: string } | null;
  request: DelegationRequestPreview | null;
  parties: DelegationPartyWithActor[];
  credentials: DelegationCredentialOverrideWithCredential[];
  attestation: IdentityDelegationAttestation | null;
};

export let identityDelegationAttestationPresenter = (
  attestation: IdentityDelegationAttestation
) => ({
  object: 'identity.delegation_attestation',

  id: attestation.id,
  type: attestation.type,

  createdAt: attestation.createdAt
});

export let identityDelegationPresenter = (delegation: DelegationWithRelations) => ({
  object: 'identity.delegation',

  id: delegation.id,
  status: delegation.status,
  deniedReason: delegation.deniedReason,
  delegationLevel: delegation.delegationLevel,
  permissions: mapPermissionsFromStorage(delegation.permissions),

  note: delegation.note,
  metadata: delegation.metadata,

  delegationConfigId: delegation.delegationConfig?.id ?? null,

  identity: {
    object: 'identity#preview',

    id: delegation.identity.id,
    name: delegation.identity.name,
    description: delegation.identity.description,
    metadata: delegation.identity.metadata
  },

  parties: delegation.parties.map(identityDelegationPartyPresenter),
  request: delegation.request
    ? identityDelegationRequestPreviewPresenter(delegation.request, delegation)
    : null,
  credentialOverrides: delegation.credentials.map(
    identityDelegationCredentialOverridePresenter
  ),
  attestation: delegation.attestation
    ? identityDelegationAttestationPresenter(delegation.attestation)
    : null,

  createdAt: delegation.createdAt,
  expiresAt: delegation.expiresAt,
  revokedAt: delegation.revokedAt
});

type DelegationRequestWithDelegation = IdentityDelegationRequest & {
  requester: IdentityActor & {
    agent: Agent | null;
  };
  identity: Identity;
  delegation: DelegationWithRelations;
};

export let identityDelegationRequestPresenter = (
  request: DelegationRequestWithDelegation
) => ({
  object: 'identity.delegation_request',

  id: request.id,
  status: request.status,
  deniedReason: request.delegation.deniedReason,

  requester: identityActorPresenter(request.requester),
  identityId: request.identity.id,
  delegation: identityDelegationPresenter(request.delegation),

  expiresAt: request.expiresAt,
  createdAt: request.createdAt
});
