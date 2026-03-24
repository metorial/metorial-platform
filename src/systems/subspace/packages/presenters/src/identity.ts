import type {
  Agent,
  Identity,
  IdentityActor,
  IdentityCredential,
  IdentityDelegationConfig,
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment
} from '@metorial-subspace/db';
import { identityActorPresenter } from './identityActor';
import { identityCredentialPresenter } from './identityCredential';

export let identityPresenter = (
  identity: Identity & {
    actor: IdentityActor & {
      agent: Agent | null;
    };
    delegationConfig: IdentityDelegationConfig | null;
    credentials: (IdentityCredential & {
      identity: Identity;
      provider: Provider;
      deployment: ProviderDeployment | null;
      config: ProviderConfig | null;
      authConfig: ProviderAuthConfig | null;
      delegationConfig: IdentityDelegationConfig | null;
    })[];
  }
) => ({
  object: 'identity',

  id: identity.id,
  status: identity.status,

  name: identity.name,
  description: identity.description,
  metadata: identity.metadata,

  owner: {
    type: 'actor',
    actor: identityActorPresenter(identity.actor)
  },

  credentials: identity.credentials.map(identityCredentialPresenter),
  delegationConfigId: identity.delegationConfig?.id ?? null,

  createdAt: identity.createdAt,
  updatedAt: identity.updatedAt,
  archivedAt: identity.archivedAt
});
