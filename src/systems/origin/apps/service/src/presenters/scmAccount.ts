import type { ScmAccount } from '../../prisma/generated/client';

export let scmAccountPresenter = (account: ScmAccount) => ({
  object: 'origin#scmAccount',

  id: account.id,
  provider: account.provider,
  type: account.type,

  name: account.name,
  identifier: account.identifier,
  externalId: account.externalId,

  createdAt: account.createdAt,
  updatedAt: account.updatedAt
});
