import type { Environment } from '../db';

export let environmentPresenter = (environment: Environment) => ({
  object: 'synthesis#environment',
  id: environment.id,
  type: environment.type,
  identifier: environment.identifier,
  name: environment.name,
  createdAt: environment.createdAt
});
