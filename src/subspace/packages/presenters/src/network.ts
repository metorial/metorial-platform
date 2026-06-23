import type { Network } from '@metorial-subspace/db';

export let networkPresenter = (network: Network) => ({
  object: 'network',

  id: network.id,
  name: network.name,
  description: network.description,

  createdAt: network.createdAt,
  updatedAt: network.updatedAt
});
