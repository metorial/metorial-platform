import type { ContainerRegistry } from '../client';

export let containerRegistryPresenter = (registry: ContainerRegistry) => ({
  object: 'container_registry',

  id: registry.id,
  type: registry.type,
  name: registry.name,
  url: registry.url,
  createdAt: registry.createdAt
});
