import type {
  ContainerRegistry,
  ContainerRepository,
  ContainerRepositoryVersion,
  Tenant
} from '../../prisma/generated/client';
import { containerRepositoryPresenter } from './containerRepository';

export let containerRepositoryVersionPresenter = (
  containerRepositoryVersion: ContainerRepositoryVersion & {
    tenant: Tenant | null;
    repository: ContainerRepository & {
      registry: ContainerRegistry;
    };
  }
) => ({
  object: 'shuttle#container_repository.version',

  id: containerRepositoryVersion.id,

  digest: containerRepositoryVersion.digest,

  repository: containerRepositoryPresenter({
    ...containerRepositoryVersion.repository,
    tenant: containerRepositoryVersion.tenant
  }),

  tenantId: containerRepositoryVersion.tenant?.id,
  createdAt: containerRepositoryVersion.createdAt
});
