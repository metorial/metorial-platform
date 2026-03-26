import type { ScmConnection } from '../origin';

export let scmConnectionPresenter = (scmConnection: ScmConnection) => ({
  object: 'scm.connection',

  id: scmConnection.id,
  provider: scmConnection.provider,

  externalInstallationId: scmConnection.externalInstallationId,
  accountType: scmConnection.accountType,

  externalAccountId: scmConnection.externalAccountId,
  externalAccountLogin: scmConnection.externalAccountLogin,
  externalAccountName: scmConnection.externalAccountName,
  externalAccountEmail: scmConnection.externalAccountEmail,
  externalAccountImageUrl: scmConnection.externalAccountImageUrl,

  createdAt: scmConnection.createdAt,
  updatedAt: scmConnection.updatedAt
});
