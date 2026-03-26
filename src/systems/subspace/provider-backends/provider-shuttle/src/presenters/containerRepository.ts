import type { ContainerRepository } from '../client';
import { containerRegistryPresenter } from './containerRegistry';

export let containerRepositoryPresenter = (repository: ContainerRepository) => ({
  object: 'container_repository',

  id: repository.id,
  type: repository.type,
  name: repository.name,
  registry: containerRegistryPresenter(repository.registry),
  createdAt: repository.createdAt
});
