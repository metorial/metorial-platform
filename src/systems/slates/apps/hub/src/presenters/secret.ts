import type { Secret } from '../../prisma/generated/client';

export let secretPresenter = (secret: Secret) => ({
  object: 'secret',

  id: secret.id,
  type: secret.type,
  status: secret.status,

  createdAt: secret.createdAt
});
