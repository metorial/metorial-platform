import type {
  DelegatedIntegrationInstance,
  DelegatedIntegrationInstanceSource,
  IntegrationInstance
} from '@metorial-subspace/db';
import {
  delegatedIntegrationInstanceProviderPresenter,
  type PresentedDelegatedIntegrationInstanceProvider
} from './delegatedIntegrationInstanceProvider';

export type PresentedDelegatedIntegrationInstanceSource =
  DelegatedIntegrationInstanceSource & {
    delegatedIntegrationInstance?: DelegatedIntegrationInstance | null;
    integrationInstance: IntegrationInstance;
  };

export type PresentedDelegatedIntegrationInstance = DelegatedIntegrationInstance & {
  sources: PresentedDelegatedIntegrationInstanceSource[];
  providers: PresentedDelegatedIntegrationInstanceProvider[];
};

export let delegatedIntegrationInstanceSourcePresenter = (
  source: PresentedDelegatedIntegrationInstanceSource
) => ({
  object: 'delegated.integration.instance.source',

  id: source.id,
  status: source.status,

  delegatedIntegrationInstanceId: source.delegatedIntegrationInstance?.id ?? null,
  integrationInstanceId: source.integrationInstance.id,

  createdAt: source.createdAt,
  updatedAt: source.updatedAt,
  archivedAt: source.archivedAt
});

export let delegatedIntegrationInstancePresenter = (
  delegatedIntegrationInstance: PresentedDelegatedIntegrationInstance
) => ({
  object: 'delegated.integration.instance',

  id: delegatedIntegrationInstance.id,
  status: delegatedIntegrationInstance.status,

  name: delegatedIntegrationInstance.name,
  description: delegatedIntegrationInstance.description,
  metadata: delegatedIntegrationInstance.metadata,
  privateMetadata: delegatedIntegrationInstance.privateMetadata,

  sources: delegatedIntegrationInstance.sources.map(
    delegatedIntegrationInstanceSourcePresenter
  ),
  providers: delegatedIntegrationInstance.providers.map(
    delegatedIntegrationInstanceProviderPresenter
  ),

  createdAt: delegatedIntegrationInstance.createdAt,
  updatedAt: delegatedIntegrationInstance.updatedAt,
  archivedAt: delegatedIntegrationInstance.archivedAt
});
