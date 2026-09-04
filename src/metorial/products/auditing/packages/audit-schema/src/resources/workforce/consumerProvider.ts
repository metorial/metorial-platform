import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let consumerProviderDeploymentAuditResource = resource({
  name: 'consumer_provider_deployment',
  payload: v.typedAny<{
    providerTemplate: { id: string; name: string };
    provider: { id: string; name: string };
    magicMcpServer: { id: string; name: string | null };
    integrationInstanceId: string | null;
  }>('consumer_provider_deployment'),
  presenter: undefined,
  actions: {
    deploy: true
  }
});

export let consumerSurfaceProviderGroupAuditResource = resource({
  name: 'consumer_surface_provider_group',
  payload: v.typedAny<{
    id: string;
    name: string;
    description: string | null;
    index: number;
    consumerSurfaceId: string | null;
  }>('consumer_surface_provider_group'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let consumerSurfaceProviderGroupListingAuditResource = resource({
  name: 'consumer_surface_provider_group_listing',
  payload: v.typedAny<{
    consumerSurfaceProviderGroup: { id: string; name: string };
    consumerAccessListingId: string;
  }>('consumer_surface_provider_group_listing'),
  presenter: undefined,
  actions: {
    add: true,
    remove: true
  }
});
