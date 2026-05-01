import type {
  IntegrationInstanceGroup,
  IntegrationInstanceGroupSource,
  IntegrationInstance,
  MagicMcpEndpointBacking
} from '@metorial-subspace/db';
import {
  integrationInstanceGroupProviderPresenter,
  type PresentedIntegrationInstanceGroupProvider
} from './integrationInstanceGroupProvider';

export type PresentedIntegrationInstanceGroupSource =
  IntegrationInstanceGroupSource & {
    integrationInstanceGroup: IntegrationInstanceGroup | null;
    integrationInstance: IntegrationInstance;
  };

export type PresentedIntegrationInstanceGroup = IntegrationInstanceGroup & {
  sources: PresentedIntegrationInstanceGroupSource[];
  providers: PresentedIntegrationInstanceGroupProvider[];
  magicMcpEndpointBacking: MagicMcpEndpointBacking | null;
};

export let integrationInstanceGroupSourcePresenter = (
  source: PresentedIntegrationInstanceGroupSource
) => ({
  object: 'integration.instance.group.source',

  id: source.id,
  status: source.status,

  integrationInstanceGroupId: source.integrationInstanceGroup?.id ?? null,
  integrationInstanceId: source.integrationInstance.id,

  createdAt: source.createdAt,
  updatedAt: source.updatedAt,
  archivedAt: source.archivedAt
});

export let integrationInstanceGroupPresenter = (
  integrationInstanceGroup: PresentedIntegrationInstanceGroup
) => ({
  object: 'integration.instance.group',

  id: integrationInstanceGroup.id,
  status: integrationInstanceGroup.status,

  name: integrationInstanceGroup.name,
  description: integrationInstanceGroup.description,
  metadata: integrationInstanceGroup.metadata,
  privateMetadata: integrationInstanceGroup.privateMetadata,
  magicMcpEndpointBackingId: integrationInstanceGroup.magicMcpEndpointBacking?.id ?? null,

  sources: integrationInstanceGroup.sources.map(
    integrationInstanceGroupSourcePresenter
  ),
  providers: integrationInstanceGroup.providers.map(
    integrationInstanceGroupProviderPresenter
  ),

  createdAt: integrationInstanceGroup.createdAt,
  updatedAt: integrationInstanceGroup.updatedAt,
  archivedAt: integrationInstanceGroup.archivedAt
});
