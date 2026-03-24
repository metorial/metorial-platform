import type {
  IdentityDelegationConfig,
  IdentityDelegationConfigVersion
} from '@metorial-subspace/db';

export let identityDelegationConfigPresenter = (
  delegationConfig: IdentityDelegationConfig & {
    currentVersion: IdentityDelegationConfigVersion | null;
  }
) => ({
  object: 'identity.delegation_config',

  id: delegationConfig.id,
  status: delegationConfig.status,
  isDefault: delegationConfig.isDefault,

  name: delegationConfig.name,
  description: delegationConfig.description,
  metadata: delegationConfig.metadata,

  subDelegationBehavior: delegationConfig.currentVersion?.subDelegationBehavior ?? 'deny',
  subDelegationDepth: delegationConfig.currentVersion?.subDelegationDepth ?? 0,

  createdAt: delegationConfig.createdAt,
  updatedAt: delegationConfig.updatedAt,
  archivedAt: delegationConfig.archivedAt
});
