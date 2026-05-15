import type { Environment } from '@metorial-cargo/db';

export let environmentPresenter = (environment: Environment) => ({
  object: 'cargo#environment',
  id: environment.id,
  identifier: environment.identifier,
  name: environment.name,
  type: environment.type,
  createdAt: environment.createdAt
});
