import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  type AdapterIntegration,
  type AdapterIntegrationInstance,
  type AdapterIntegrationInstanceProvider,
  type AdapterIntegrationProvider,
  type AdapterIntegrationType,
  type Environment,
  getId,
  type Integration,
  type IntegrationInstance,
  type ProviderAdapterGlobal,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { integrationService } from '../services/integration';
import { integrationInstanceService } from '../services/integrationInstance';
import {
  integrationInstanceProviderService,
  type SetIntegrationInstanceProviderInput
} from '../services/integrationInstanceProvider';
import {
  integrationProviderService,
  type CreateIntegrationProviderParams,
  type UpdateIntegrationProviderParams
} from '../services/integrationProvider';
import {
  adapterInstanceLiveStatuses,
  adapterLiveStatuses,
  adapterScopeFromIntegration,
  assertProviderImplementsAdapter,
  isLiveAdapterInstanceStatus,
  isLiveAdapterStatus,
  listAdapterCapableIntegrationInstanceProviders,
  listAdapterCapableIntegrationProviders,
  requireLiveAdapterIntegration,
  requireLiveAdapterInstance,
  toAdapterInstanceStatus
} from './helpers';

export type { SetIntegrationInstanceProviderInput };

export type AdapterCause = 'product' | 'integration';

export type EnsureAdapterIntegrationParams = {
  tenant: Tenant;
  environment: Environment;
  type: AdapterIntegrationType;
  adapterGlobal: ProviderAdapterGlobal;
  isStandalone: boolean;
  presentation?: { name: string };
  integration?: Integration;
};

export type CreateStandaloneAdapterInstanceInput = {
  name?: string;
  identity?: { identityActorId?: string | null; identityId?: string | null };
  providers?: SetIntegrationInstanceProviderInput[];
};

let loadAdapterIntegration = (oid: bigint) =>
  withTransaction(async db =>
    db.adapterIntegration.findUniqueOrThrow({
      where: { oid },
      include: { integration: true, adapterGlobal: true }
    })
  );

let loadAdapterInstance = (oid: bigint) =>
  withTransaction(async db =>
    db.adapterIntegrationInstance.findUniqueOrThrow({
      where: { oid },
      include: {
        adapterIntegration: { include: { adapterGlobal: true, integration: true } },
        integrationInstance: true
      }
    })
  );

let rejectExistingProviderMutation = () => {
  throw new ServiceError(
    badRequestError({
      code: 'adapter_integration_providers_managed_by_integration',
      message:
        'Definition providers for an existing adapter integration are managed by the integration.'
    })
  );
};

let liveInstanceStatus = (integrationInstance: IntegrationInstance) =>
  isLiveAdapterInstanceStatus(integrationInstance.status)
    ? toAdapterInstanceStatus(integrationInstance.status)
    : ('active' as const);

export let syncAdapterProviders = async (d: { adapterIntegration: AdapterIntegration }) => {
  return withTransaction(async db => {
    let adapterIntegration = await loadAdapterIntegration(d.adapterIntegration.oid);
    requireLiveAdapterIntegration(adapterIntegration);

    let capable = await listAdapterCapableIntegrationProviders({
      integrationOid: adapterIntegration.integrationOid,
      adapterGlobalOid: adapterIntegration.adapterGlobalOid
    });
    let capableOids = new Set(capable.map(provider => provider.oid));
    let links: AdapterIntegrationProvider[] = [];

    for (let integrationProvider of capable) {
      let existing = await db.adapterIntegrationProvider.findUnique({
        where: {
          adapterIntegrationOid_integrationProviderOid: {
            adapterIntegrationOid: adapterIntegration.oid,
            integrationProviderOid: integrationProvider.oid
          }
        }
      });

      let link = existing
        ? await db.adapterIntegrationProvider.update({
            where: { oid: existing.oid },
            data: { status: 'active' }
          })
        : await db.adapterIntegrationProvider.create({
            data: {
              ...getId('adapterIntegrationProvider'),
              status: 'active',
              ...adapterScopeFromIntegration(adapterIntegration.integration),
              adapterIntegrationOid: adapterIntegration.oid,
              integrationOid: adapterIntegration.integrationOid,
              integrationProviderOid: integrationProvider.oid
            }
          });

      links.push(link);
    }

    await db.adapterIntegrationProvider.updateMany({
      where: {
        adapterIntegrationOid: adapterIntegration.oid,
        status: { in: [...adapterLiveStatuses] },
        integrationProviderOid: { notIn: [...capableOids] }
      },
      data: { status: 'archived' }
    });

    return links;
  });
};

export let syncAdapterInstanceProviders = async (d: {
  adapterIntegrationInstance: AdapterIntegrationInstance;
}) => {
  return withTransaction(async db => {
    let adapterInstance = await loadAdapterInstance(d.adapterIntegrationInstance.oid);
    if (!isLiveAdapterInstanceStatus(adapterInstance.status)) return [];

    let adapterIntegration = adapterInstance.adapterIntegration;
    requireLiveAdapterIntegration(adapterIntegration);

    let capable = await listAdapterCapableIntegrationInstanceProviders({
      integrationInstanceOid: adapterInstance.integrationInstanceOid,
      adapterGlobalOid: adapterIntegration.adapterGlobalOid
    });
    let adapterProviders = await db.adapterIntegrationProvider.findMany({
      where: {
        adapterIntegrationOid: adapterIntegration.oid,
        status: { in: [...adapterLiveStatuses] }
      }
    });
    let adapterProviderByIntegrationProviderOid = new Map(
      adapterProviders.map(provider => [provider.integrationProviderOid, provider])
    );

    let keepOids: bigint[] = [];
    let links: AdapterIntegrationInstanceProvider[] = [];

    for (let instanceProvider of capable) {
      let adapterProvider = adapterProviderByIntegrationProviderOid.get(
        instanceProvider.integrationProviderOid
      );
      if (!adapterProvider) continue;

      let existing = await db.adapterIntegrationInstanceProvider.findUnique({
        where: {
          adapterIntegrationInstanceOid_adapterIntegrationProviderOid: {
            adapterIntegrationInstanceOid: adapterInstance.oid,
            adapterIntegrationProviderOid: adapterProvider.oid
          }
        }
      });

      let link = existing
        ? await db.adapterIntegrationInstanceProvider.update({
            where: { oid: existing.oid },
            data: { status: 'active' }
          })
        : await db.adapterIntegrationInstanceProvider.create({
            data: {
              ...getId('adapterIntegrationInstanceProvider'),
              status: 'active',
              ...adapterScopeFromIntegration(adapterIntegration.integration),
              adapterIntegrationInstanceOid: adapterInstance.oid,
              adapterIntegrationProviderOid: adapterProvider.oid,
              adapterIntegrationOid: adapterIntegration.oid,
              integrationInstanceProviderOid: instanceProvider.oid,
              integrationInstanceOid: adapterInstance.integrationInstanceOid,
              integrationProviderOid: instanceProvider.integrationProviderOid,
              integrationOid: adapterIntegration.integrationOid
            }
          });

      keepOids.push(link.oid);
      links.push(link);
    }

    await db.adapterIntegrationInstanceProvider.updateMany({
      where: {
        adapterIntegrationInstanceOid: adapterInstance.oid,
        status: { in: [...adapterLiveStatuses] },
        oid: { notIn: keepOids }
      },
      data: { status: 'archived' }
    });

    return links;
  });
};

export let syncAdapterInstanceStatus = async (d: {
  adapterInstance: AdapterIntegrationInstance;
}) => {
  return withTransaction(async db => {
    let adapterInstance = await loadAdapterInstance(d.adapterInstance.oid);
    if (!isLiveAdapterInstanceStatus(adapterInstance.status)) return adapterInstance;

    let nextStatus = toAdapterInstanceStatus(adapterInstance.integrationInstance.status);
    if (!isLiveAdapterInstanceStatus(nextStatus)) return adapterInstance;
    if (adapterInstance.status === nextStatus) return adapterInstance;

    return db.adapterIntegrationInstance.update({
      where: { oid: adapterInstance.oid },
      data: { status: nextStatus }
    });
  });
};

export let ensureAdapterIntegration = async (d: EnsureAdapterIntegrationParams) => {
  return withTransaction(async db => {
    if (d.isStandalone) {
      if (!d.presentation?.name?.trim()) {
        throw new ServiceError(
          badRequestError({
            code: 'adapter_integration_name_required',
            message: 'A name is required to create a standalone adapter integration.'
          })
        );
      }

      let adapterId = getId('adapterIntegration');
      let integration = await integrationService.createIntegrationInternal({
        tenant: d.tenant,
        environment: d.environment,
        slug: `adapter-${d.type}-${adapterId.id}`,
        isAdapterBacking: true,
        input: {
          name: d.presentation.name.trim(),
          description: '',
          metadata: {}
        }
      });

      let adapterIntegration = await db.adapterIntegration.create({
        data: {
          ...adapterId,
          type: d.type,
          status: 'active',
          isStandalone: true,
          adapterGlobalOid: d.adapterGlobal.oid,
          ...adapterScopeFromIntegration(integration),
          integrationOid: integration.oid
        }
      });

      await syncAdapterProviders({ adapterIntegration });

      return loadAdapterIntegration(adapterIntegration.oid);
    }

    if (!d.integration) {
      throw new ServiceError(
        badRequestError({
          code: 'adapter_integration_required',
          message: 'An existing integration is required when isStandalone is false.'
        })
      );
    }

    if (d.integration.isMagicMcpBacking) {
      throw new ServiceError(
        badRequestError({
          code: 'adapter_integration_magic_mcp_blocked',
          message: 'Magic MCP owned integrations cannot be attached to an adapter.'
        })
      );
    }

    let capable = await listAdapterCapableIntegrationProviders({
      integrationOid: d.integration.oid,
      adapterGlobalOid: d.adapterGlobal.oid
    });
    if (capable.length === 0) {
      throw new ServiceError(
        badRequestError({
          code: 'adapter_integration_no_capable_providers',
          message: 'The integration has no providers that implement the requested adapter.'
        })
      );
    }

    let live = await db.adapterIntegration.findFirst({
      where: {
        integrationOid: d.integration.oid,
        type: d.type,
        status: { in: [...adapterLiveStatuses] }
      }
    });

    let adapterIntegration =
      live ??
      (await db.adapterIntegration.create({
        data: {
          ...getId('adapterIntegration'),
          type: d.type,
          status: 'active',
          isStandalone: false,
          adapterGlobalOid: d.adapterGlobal.oid,
          ...adapterScopeFromIntegration(d.integration),
          integrationOid: d.integration.oid
        }
      }));

    await syncAdapterProviders({ adapterIntegration });

    return loadAdapterIntegration(adapterIntegration.oid);
  });
};

export let applyAdapterIntegrationPresentation = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterIntegration: AdapterIntegration;
  name: string;
}) => {
  return withTransaction(async () => {
    let adapterIntegration = await loadAdapterIntegration(d.adapterIntegration.oid);
    if (!adapterIntegration.isStandalone) return adapterIntegration.integration;

    return integrationService.updateIntegrationInternal({
      tenant: d.tenant,
      environment: d.environment,
      integration: adapterIntegration.integration,
      input: { name: d.name }
    });
  });
};

export let ensureAdapterProvider = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterIntegration: AdapterIntegration;
  input: CreateIntegrationProviderParams['input'];
}) => {
  return withTransaction(async db => {
    let adapterIntegration = await loadAdapterIntegration(d.adapterIntegration.oid);
    requireLiveAdapterIntegration(adapterIntegration);
    if (!adapterIntegration.isStandalone) rejectExistingProviderMutation();

    let provider = await db.provider.findFirst({
      where: { id: d.input.providerId }
    });
    if (provider) {
      await assertProviderImplementsAdapter({
        providerOid: provider.oid,
        adapterGlobalOid: adapterIntegration.adapterGlobalOid
      });
    }

    let integrationProvider = await integrationProviderService.createIntegrationProviderInternal({
      tenant: d.tenant,
      environment: d.environment,
      integration: adapterIntegration.integration,
      input: d.input
    });

    let links = await syncAdapterProviders({ adapterIntegration });
    let link = links.find(item => item.integrationProviderOid === integrationProvider.oid);
    if (!link) {
      throw new ServiceError(
        badRequestError({
          code: 'adapter_integration_provider_not_synced',
          message: 'The adapter provider link could not be created.'
        })
      );
    }

    return db.adapterIntegrationProvider.findUniqueOrThrow({ where: { oid: link.oid } });
  });
};

export let updateAdapterProvider = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterIntegrationProvider: AdapterIntegrationProvider;
  input: UpdateIntegrationProviderParams['input'];
}) => {
  return withTransaction(async db => {
    let adapterProvider = await db.adapterIntegrationProvider.findUniqueOrThrow({
      where: { oid: d.adapterIntegrationProvider.oid },
      include: {
        adapterIntegration: { include: { integration: true, adapterGlobal: true } },
        integrationProvider: true
      }
    });
    requireLiveAdapterIntegration(adapterProvider.adapterIntegration);
    if (!adapterProvider.adapterIntegration.isStandalone) rejectExistingProviderMutation();

    await integrationProviderService.updateIntegrationProviderInternal({
      tenant: d.tenant,
      environment: d.environment,
      integrationProvider: adapterProvider.integrationProvider,
      input: d.input
    });

    await syncAdapterProviders({ adapterIntegration: adapterProvider.adapterIntegration });

    return db.adapterIntegrationProvider.findUniqueOrThrow({
      where: { oid: adapterProvider.oid }
    });
  });
};

export let removeAdapterProvider = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterIntegrationProvider: AdapterIntegrationProvider;
}) => {
  return withTransaction(async db => {
    let adapterProvider = await db.adapterIntegrationProvider.findUniqueOrThrow({
      where: { oid: d.adapterIntegrationProvider.oid },
      include: {
        adapterIntegration: { include: { integration: true, adapterGlobal: true } },
        integrationProvider: true
      }
    });
    requireLiveAdapterIntegration(adapterProvider.adapterIntegration);
    if (!adapterProvider.adapterIntegration.isStandalone) rejectExistingProviderMutation();

    await integrationProviderService.archiveIntegrationProviderInternal({
      tenant: d.tenant,
      environment: d.environment,
      integrationProvider: adapterProvider.integrationProvider
    });

    await syncAdapterProviders({ adapterIntegration: adapterProvider.adapterIntegration });

    return db.adapterIntegrationProvider.findUniqueOrThrow({
      where: { oid: adapterProvider.oid }
    });
  });
};

export let removeAdapterInstance = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterInstance: AdapterIntegrationInstance;
  cause: AdapterCause;
}) => {
  return withTransaction(async db => {
    let adapterInstance = await loadAdapterInstance(d.adapterInstance.oid);
    if (!isLiveAdapterInstanceStatus(adapterInstance.status)) return adapterInstance;

    await db.adapterIntegrationInstanceProvider.updateMany({
      where: {
        adapterIntegrationInstanceOid: adapterInstance.oid,
        status: { not: 'deleted' }
      },
      data: { status: 'archived' }
    });

    let archived = await db.adapterIntegrationInstance.update({
      where: { oid: adapterInstance.oid },
      data: { status: 'archived' }
    });

    if (adapterInstance.isStandalone && d.cause === 'product') {
      await integrationInstanceService.archiveIntegrationInstanceInternal({
        tenant: d.tenant,
        environment: d.environment,
        integrationInstance: adapterInstance.integrationInstance,
        _canModifyAdapterBacking: true
      });
    }

    return archived;
  });
};

export let removeAdapterIntegration = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterIntegration: AdapterIntegration;
  cause: AdapterCause;
}) => {
  return withTransaction(async db => {
    let adapterIntegration = await loadAdapterIntegration(d.adapterIntegration.oid);
    if (!isLiveAdapterStatus(adapterIntegration.status)) return adapterIntegration;

    let instances = await db.adapterIntegrationInstance.findMany({
      where: {
        adapterIntegrationOid: adapterIntegration.oid,
        status: { in: [...adapterInstanceLiveStatuses] }
      }
    });
    for (let instance of instances) {
      await removeAdapterInstance({
        tenant: d.tenant,
        environment: d.environment,
        adapterInstance: instance,
        cause: d.cause
      });
    }

    await db.adapterIntegrationProvider.updateMany({
      where: {
        adapterIntegrationOid: adapterIntegration.oid,
        status: { not: 'deleted' }
      },
      data: { status: 'archived' }
    });

    let archived = await db.adapterIntegration.update({
      where: { oid: adapterIntegration.oid },
      data: { status: 'archived' }
    });

    if (adapterIntegration.isStandalone && d.cause === 'product') {
      await integrationService.archiveIntegrationInternal({
        tenant: d.tenant,
        environment: d.environment,
        integration: adapterIntegration.integration,
        _canModifyAdapterBacking: true
      });
    }

    return archived;
  });
};

export let ensureAdapterInstance = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterIntegration: AdapterIntegration;
  integrationInstance?: IntegrationInstance;
  createStandaloneInstance?: CreateStandaloneAdapterInstanceInput;
}) => {
  return withTransaction(async db => {
    let adapterIntegration = await loadAdapterIntegration(d.adapterIntegration.oid);
    requireLiveAdapterIntegration(adapterIntegration);

    let createHiddenInstance = async (input: CreateStandaloneAdapterInstanceInput) => {
      let integrationInstance = await integrationInstanceService.createIntegrationInstanceInternal(
        {
          tenant: d.tenant,
          environment: d.environment,
          integration: adapterIntegration.integration,
          isAdapterBacking: true,
          input: {
            name: input.name?.trim() || adapterIntegration.integration.name,
            identityActorId: input.identity?.identityActorId,
            identityId: input.identity?.identityId,
            providers: input.providers
          }
        }
      );

      return { integrationInstance, isStandalone: true as const };
    };

    let resolved: { integrationInstance: IntegrationInstance; isStandalone: boolean };

    if (adapterIntegration.isStandalone) {
      if (d.integrationInstance) {
        throw new ServiceError(
          badRequestError({
            code: 'adapter_instance_link_blocked_for_standalone',
            message:
              'Standalone adapter integrations always create hidden instances and cannot link a visible instance.'
          })
        );
      }

      resolved = await createHiddenInstance(d.createStandaloneInstance ?? {});
    } else if (d.integrationInstance) {
      if (d.integrationInstance.integrationOid !== adapterIntegration.integrationOid) {
        throw new ServiceError(
          badRequestError({
            code: 'adapter_instance_integration_mismatch',
            message: 'The integration instance does not belong to this integration.'
          })
        );
      }

      resolved = { integrationInstance: d.integrationInstance, isStandalone: false };
    } else if (d.createStandaloneInstance) {
      resolved = await createHiddenInstance(d.createStandaloneInstance);
    } else {
      throw new ServiceError(
        badRequestError({
          code: 'adapter_instance_source_required',
          message:
            'Provide an existing integration instance or createStandaloneInstance for a non-standalone adapter integration.'
        })
      );
    }

    let existing = await db.adapterIntegrationInstance.findUnique({
      where: {
        adapterIntegrationOid_integrationInstanceOid: {
          adapterIntegrationOid: adapterIntegration.oid,
          integrationInstanceOid: resolved.integrationInstance.oid
        }
      }
    });

    let status = liveInstanceStatus(resolved.integrationInstance);

    let adapterInstance = existing
      ? await db.adapterIntegrationInstance.update({
          where: { oid: existing.oid },
          data: { status, isStandalone: resolved.isStandalone }
        })
      : await db.adapterIntegrationInstance.create({
          data: {
            ...getId('adapterIntegrationInstance'),
            status,
            isStandalone: resolved.isStandalone,
            ...adapterScopeFromIntegration(adapterIntegration.integration),
            adapterIntegrationOid: adapterIntegration.oid,
            integrationInstanceOid: resolved.integrationInstance.oid,
            integrationOid: adapterIntegration.integrationOid
          }
        });

    await syncAdapterInstanceProviders({ adapterIntegrationInstance: adapterInstance });

    return loadAdapterInstance(adapterInstance.oid);
  });
};

export let applyAdapterInstancePresentation = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterInstance: AdapterIntegrationInstance;
  name: string;
}) => {
  return withTransaction(async () => {
    let adapterInstance = await loadAdapterInstance(d.adapterInstance.oid);
    if (!adapterInstance.isStandalone) return adapterInstance.integrationInstance;

    return integrationInstanceService.updateIntegrationInstanceInternal({
      tenant: d.tenant,
      environment: d.environment,
      integrationInstance: adapterInstance.integrationInstance,
      input: { name: d.name }
    });
  });
};

export let setAdapterInstanceProvider = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterInstance: AdapterIntegrationInstance;
  input: SetIntegrationInstanceProviderInput;
}) => {
  return withTransaction(async db => {
    let adapterInstance = await loadAdapterInstance(d.adapterInstance.oid);
    requireLiveAdapterIntegration(adapterInstance.adapterIntegration);
    requireLiveAdapterInstance(adapterInstance);

    let provider = await db.provider.findFirst({ where: { id: d.input.providerId } });
    if (provider) {
      await assertProviderImplementsAdapter({
        providerOid: provider.oid,
        adapterGlobalOid: adapterInstance.adapterIntegration.adapterGlobalOid
      });
    } else {
      let integrationProvider = await db.integrationProvider.findFirst({
        where: { id: d.input.providerId }
      });
      if (!integrationProvider) {
        throw new ServiceError(
          badRequestError({
            code: 'provider_not_found',
            message: 'The provider could not be found.'
          })
        );
      }

      await assertProviderImplementsAdapter({
        providerOid: integrationProvider.providerOid,
        adapterGlobalOid: adapterInstance.adapterIntegration.adapterGlobalOid
      });
    }

    await integrationInstanceProviderService.setIntegrationInstanceProviderInternal({
      tenant: d.tenant,
      environment: d.environment,
      integrationInstance: adapterInstance.integrationInstance,
      input: d.input
    });

    let links = await syncAdapterInstanceProviders({
      adapterIntegrationInstance: adapterInstance
    });

    return links;
  });
};
