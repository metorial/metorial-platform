import type {
  ContainerRegistry,
  ContainerRepository,
  ContainerRepositoryTag,
  ContainerRepositoryVersion,
  Tenant
} from '../../prisma/generated/client';
import { containerRepositoryPresenter } from './containerRepository';
import { containerRepositoryVersionPresenter } from './containerRepositoryVersion';

export let containerRepositoryTagPresenter = (
  containerRepositoryTag: ContainerRepositoryTag & {
    tenant: Tenant | null;
    currentVersion: ContainerRepositoryVersion | null;
    repository: ContainerRepository & {
      registry: ContainerRegistry;
    };
  }
) => ({
  object: 'shuttle#container_repository.tag',

  id: containerRepositoryTag.id,

  type: containerRepositoryTag.type,
  name: containerRepositoryTag.name,

  repository: containerRepositoryPresenter({
    ...containerRepositoryTag.repository,
    tenant: containerRepositoryTag.tenant
  }),

  currentVersion: containerRepositoryTag.currentVersion
    ? containerRepositoryVersionPresenter({
        ...containerRepositoryTag.currentVersion,
        tenant: containerRepositoryTag.tenant,
        repository: containerRepositoryTag.repository
      })
    : null,

  tenantId: containerRepositoryTag.tenant?.id,

  createdAt: containerRepositoryTag.createdAt
});
