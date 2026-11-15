import type { ContainerRegistry, Tenant } from '../../prisma/generated/client';

export let containerRegistryPresenter = (
  containerRegistry: ContainerRegistry & {
    tenant: Tenant | null;
  }
) => ({
  object: 'shuttle#container_registry',

  id: containerRegistry.id,

  type: containerRegistry.type,
  name: containerRegistry.name,
  url: containerRegistry.url,

  tenantId: containerRegistry.tenant?.id,

  createdAt: containerRegistry.createdAt
});
