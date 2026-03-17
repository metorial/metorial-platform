import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db, type Instance, type ProviderTemplate } from '@metorial/db';
import {
  type Scope,
  accessTagService,
  consumerMagicMcpReadRoles,
  consumerProviderTemplateReadRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import {
  subspaceProviderConfigService,
  subspaceProviderDeploymentService,
  subspaceProviderService
} from '@metorial/module-subspace';
import { listProviderAuthMethods } from './providerContext';
import type {
  ConsumerMagicMcpCatalogServer,
  ConsumerProviderAvailability,
  ConsumerProviderCatalogEntry,
  ConsumerProviderTemplateCatalogEntry
} from './types';

let getProtectedConsumerProviderTemplateFilter = () => {
  return {
    some: {
      accessTagPolicy: {
        roles: {
          hasSome: [...consumerProviderTemplateReadRoles]
        }
      }
    }
  };
};

let getProtectedConsumerMagicMcpServerFilter = () => {
  return {
    some: {
      accessTagPolicy: {
        roles: {
          hasSome: [...consumerMagicMcpReadRoles]
        }
      }
    }
  };
};

let getProtectedAndAccessibleOids = async (d: {
  accessTags?: AnyAccessTagSelector;
  roles: readonly Scope[];
  listProtected: () => Promise<{ oid: bigint }[]>;
  listAccessible: (accessTagFilter: unknown) => Promise<{ oid: bigint }[]>;
}) => {
  let protectedOids = new Set((await d.listProtected()).map(resource => resource.oid));

  if (!d.accessTags) {
    return {
      protectedOids,
      accessibleOids: null as Set<bigint> | null
    };
  }

  let accessTagFilter = await accessTagService.getAccessTagFilter({
    tags: d.accessTags,
    roles: [...d.roles]
  });

  return {
    protectedOids,
    accessibleOids: new Set(
      (await d.listAccessible(accessTagFilter)).map(resource => resource.oid)
    )
  };
};

let getConsumerProviderAvailability = (d: {
  oid: bigint;
  protectedOids: Set<bigint>;
  accessibleOids: Set<bigint> | null;
}): ConsumerProviderAvailability => {
  if (d.accessibleOids?.has(d.oid) || !d.protectedOids.has(d.oid)) {
    return 'available_now';
  }

  return 'request_access';
};

export let hydratePreconfiguredMagicMcpServers = async (d: {
  magicMcpServers: ConsumerMagicMcpCatalogServer[];
  accessTags?: AnyAccessTagSelector;
}): Promise<
  Extract<
    ConsumerProviderCatalogEntry,
    {
      type: 'magic_mcp_server';
    }
  >[]
> => {
  if (!d.magicMcpServers.length) {
    return [];
  }

  let { protectedOids, accessibleOids } = await getProtectedAndAccessibleOids({
    accessTags: d.accessTags,
    roles: consumerMagicMcpReadRoles,
    listProtected: async () =>
      await db.magicMcpServer.findMany({
        where: {
          oid: {
            in: d.magicMcpServers.map(magicMcpServer => magicMcpServer.oid)
          },
          accessTagEntities: getProtectedConsumerMagicMcpServerFilter()
        },
        select: {
          oid: true
        }
      }),
    listAccessible: async accessTagFilter =>
      await db.magicMcpServer.findMany({
        where: {
          oid: {
            in: d.magicMcpServers.map(magicMcpServer => magicMcpServer.oid)
          },
          accessTagEntities: accessTagFilter as never
        },
        select: {
          oid: true
        }
      })
  });

  return d.magicMcpServers.map(magicMcpServer => ({
    type: 'magic_mcp_server' as const,
    availability: getConsumerProviderAvailability({
      oid: magicMcpServer.oid,
      protectedOids,
      accessibleOids
    }),
    magicMcpServer
  }));
};

export let hydrateConsumerProviders = async (d: {
  instance: Instance;
  providerTemplates: ProviderTemplate[];
  includeCapabilities?: boolean;
  accessTags?: AnyAccessTagSelector;
}): Promise<ConsumerProviderTemplateCatalogEntry[]> => {
  if (!d.providerTemplates.length) {
    return [];
  }

  let { protectedOids, accessibleOids } = await getProtectedAndAccessibleOids({
    accessTags: d.accessTags,
    roles: consumerProviderTemplateReadRoles,
    listProtected: async () =>
      await db.providerTemplate.findMany({
        where: {
          oid: {
            in: d.providerTemplates.map(providerTemplate => providerTemplate.oid)
          },
          accessTagEntities: getProtectedConsumerProviderTemplateFilter()
        },
        select: {
          oid: true
        }
      }),
    listAccessible: async accessTagFilter =>
      await db.providerTemplate.findMany({
        where: {
          oid: {
            in: d.providerTemplates.map(providerTemplate => providerTemplate.oid)
          },
          accessTagEntities: accessTagFilter as never
        },
        select: {
          oid: true
        }
      })
  });

  let deployments = await Promise.all(
    d.providerTemplates.map(async providerTemplate => {
      return [
        providerTemplate.providerDeploymentId,
        await subspaceProviderDeploymentService.get({
          instance: d.instance,
          providerDeploymentId: providerTemplate.providerDeploymentId
        })
      ] as const;
    })
  );
  let deploymentMap = new Map(deployments);

  let providers = await Promise.all(
    Array.from(new Set(deployments.map(([, deployment]) => deployment.providerId))).map(
      async providerId => {
        return [
          providerId,
          await subspaceProviderService.get({
            instance: d.instance,
            providerId
          })
        ] as const;
      }
    )
  );
  let providerMap = new Map(providers);

  let configSchemaMap = new Map<string, ConsumerProviderTemplateCatalogEntry['configSchema']>();
  let authMethodMap = new Map<string, ConsumerProviderTemplateCatalogEntry['authMethods']>();

  if (d.includeCapabilities) {
    await Promise.all(
      deployments.map(async ([deploymentId, deployment]) => {
        let providerTemplatesForDeployment = d.providerTemplates.filter(providerTemplate => {
          return providerTemplate.providerDeploymentId == deploymentId;
        });
        let isDeploymentAccessible = providerTemplatesForDeployment.some(providerTemplate => {
          return (
            accessibleOids?.has(providerTemplate.oid) || !protectedOids.has(providerTemplate.oid)
          );
        });

        if (!isDeploymentAccessible) {
          return;
        }

        let [configSchema, authMethods] = await Promise.all([
          subspaceProviderConfigService.getConfigSchema({
            instance: d.instance,
            providerDeploymentId: deploymentId
          }),
          listProviderAuthMethods({
            instance: d.instance,
            providerVersionId: deployment.lockedVersion?.id
          })
        ]);

        configSchemaMap.set(deploymentId, configSchema);
        authMethodMap.set(deploymentId, authMethods);
      })
    );
  }

  return d.providerTemplates.map(providerTemplate => {
    let deployment = deploymentMap.get(providerTemplate.providerDeploymentId);
    if (!deployment) {
      throw new ServiceError(notFoundError('provider.deployment'));
    }

    let provider = providerMap.get(deployment.providerId);
    if (!provider) {
      throw new ServiceError(notFoundError('provider'));
    }

    let availability = getConsumerProviderAvailability({
      oid: providerTemplate.oid,
      protectedOids,
      accessibleOids
    });

    return {
      type: 'provider_template' as const,
      availability,
      providerTemplate,
      deployment,
      provider,
      configSchema:
        availability == 'available_now'
          ? configSchemaMap.get(providerTemplate.providerDeploymentId) ?? null
          : null,
      authMethods:
        availability == 'available_now'
          ? authMethodMap.get(providerTemplate.providerDeploymentId) ?? []
          : []
    };
  });
};
