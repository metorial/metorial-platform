import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import {
  type AdapterIntegration,
  type AdapterIntegrationInstance,
  type AdapterIntegrationInstanceStatus,
  type IntegrationInstanceStatus,
  type ProviderAdapterGlobal,
  withTransaction
} from '@metorial-subspace/db';

export let adapterLiveStatuses = ['active'] as const;
export let adapterInstanceLiveStatuses = ['draft', 'active'] as const;

export let isLiveAdapterStatus = (status: string) => status === 'active';

export let isLiveAdapterInstanceStatus = (status: string) =>
  status === 'draft' || status === 'active';

export let toAdapterInstanceStatus = (
  status: IntegrationInstanceStatus
): AdapterIntegrationInstanceStatus => {
  if (status === 'draft') return 'draft';
  if (status === 'active') return 'active';
  if (status === 'archived') return 'archived';
  return 'deleted';
};

export let resolveAdapterGlobal = async (identifier: string) => {
  return withTransaction(async db => {
    let adapter = await db.providerAdapterGlobal.findUnique({
      where: { identifier }
    });
    if (!adapter) {
      throw new ServiceError(notFoundError('provider.adapter', identifier));
    }

    return adapter;
  });
};

export let assertProviderImplementsAdapter = async (d: {
  providerOid: bigint;
  adapterGlobalOid: bigint;
}) => {
  return withTransaction(async db => {
    let match = await db.providerAdapter.findFirst({
      where: {
        providerOid: d.providerOid,
        globalOid: d.adapterGlobalOid
      },
      select: { oid: true }
    });
    if (!match) {
      throw new ServiceError(
        badRequestError({
          code: 'provider_does_not_implement_adapter',
          message: 'The provider does not implement the requested adapter.'
        })
      );
    }
  });
};

export let listAdapterCapableIntegrationProviders = async (d: {
  integrationOid: bigint;
  adapterGlobalOid: bigint;
}) => {
  return withTransaction(async db => {
    return db.integrationProvider.findMany({
      where: {
        integrationOid: d.integrationOid,
        status: 'active',
        archivedAt: null,
        provider: {
          providerAdapters: {
            some: { globalOid: d.adapterGlobalOid }
          }
        }
      },
      include: { provider: true }
    });
  });
};

export let listAdapterCapableIntegrationInstanceProviders = async (d: {
  integrationInstanceOid: bigint;
  adapterGlobalOid: bigint;
}) => {
  return withTransaction(async db => {
    return db.integrationInstanceProvider.findMany({
      where: {
        integrationInstanceOid: d.integrationInstanceOid,
        status: 'active',
        archivedAt: null,
        isParentDeleted: false,
        integrationProvider: {
          status: 'active',
          archivedAt: null,
          provider: {
            providerAdapters: {
              some: { globalOid: d.adapterGlobalOid }
            }
          }
        }
      },
      include: {
        integrationProvider: true,
        integrationInstance: true
      }
    });
  });
};

export let adapterScopeFromIntegration = (d: {
  tenantOid: bigint;
  projectOid: bigint | null;
  environmentOid: bigint;
  instanceOid: bigint | null;
  solutionOid: number;
}) => ({
  tenantOid: d.tenantOid,
  projectOid: d.projectOid!,
  environmentOid: d.environmentOid,
  instanceOid: d.instanceOid!,
  solutionOid: d.solutionOid
});

export let requireLiveAdapterIntegration = (adapterIntegration: AdapterIntegration) => {
  if (!isLiveAdapterStatus(adapterIntegration.status)) {
    throw new ServiceError(
      badRequestError({
        code: 'adapter_integration_archived',
        message: 'The adapter integration is archived.'
      })
    );
  }
};

export let requireLiveAdapterInstance = (adapterInstance: AdapterIntegrationInstance) => {
  if (!isLiveAdapterInstanceStatus(adapterInstance.status)) {
    throw new ServiceError(
      badRequestError({
        code: 'adapter_instance_archived',
        message: 'The adapter instance is archived.'
      })
    );
  }
};

export type { ProviderAdapterGlobal };
