import type {
  ContainerRegistry,
  ContainerRepository,
  Tenant
} from '../../prisma/generated/client';
import { containerRegistryPresenter } from './containerRegistry';

export let containerRepositoryPresenter = (
  containerRepository: ContainerRepository & {
    tenant: Tenant | null;
    registry: ContainerRegistry;
  }
) => ({
  object: 'shuttle#container_repository',

  id: containerRepository.id,

  type: containerRepository.type,
  name: containerRepository.name,

  registry: containerRegistryPresenter({
    ...containerRepository.registry,
    tenant: containerRepository.tenant
  }),

  tenantId: containerRepository.tenant?.id,

  createdAt: containerRepository.createdAt
});
