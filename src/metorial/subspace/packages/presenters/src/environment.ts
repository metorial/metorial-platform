import type { Environment } from '@metorial-subspace/db';

export let environmentPresenter = (environment: Environment) => ({
  object: 'environment',

  id: environment.id,
  identifier: environment.identifier,
  name: environment.name,

  createdAt: environment.createdAt
});
