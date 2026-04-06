import type { ScmInstallation } from '../../prisma/generated/client';

export let scmInstallationPresenter = (installation: ScmInstallation) => ({
  object: 'origin#scm_installation',

  id: installation.id,
  provider: installation.provider,

  externalInstallationId: installation.externalInstallationId,
  accountType: installation.accountType,

  externalAccountId: installation.externalAccountId,
  externalAccountLogin: installation.externalAccountLogin,
  externalAccountName: installation.externalAccountName,
  externalAccountEmail: installation.externalAccountEmail,
  externalAccountImageUrl: installation.externalAccountImageUrl,

  createdAt: installation.createdAt,
  updatedAt: installation.updatedAt
});
