import type { Environment } from '../../prisma/generated/client';

export let environmentPresenter = (environment: Environment) => ({
  object: 'cargo#environment',
  id: environment.id,
  identifier: environment.identifier,
  name: environment.name,
  type: environment.type,
  createdAt: environment.createdAt
});
