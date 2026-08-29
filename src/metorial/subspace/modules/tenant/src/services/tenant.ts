import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import {
  db,
  type EnvironmentType,
  getId,
  type SessionDataRetentionLevel,
  type Tenant
} from '@metorial-subspace/db';
import { reconcileTenantManagedBackingsQueue } from '@metorial-subspace/module-auth/src/queues/reconcile';
import { reconcileProviderDeploymentMonitorForEnvironmentQueue } from '@metorial-subspace/module-deployment/src/queues/reconcile/providerDeploymentMonitor';
import { networkInternalService } from '@metorial-subspace/module-enclave';
import {
  linkEnvironmentToInstanceMirror,
  linkTenantToProjectMirror
} from '../lib/mirrorRecords';
import { tenantLogRetentionSyncQueue } from '../queues/retention/sync';

let include = {};

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
      resourceTenantId: string;
      resourceTenantIdentifier: string;
      onlyAllowTrustedProviders?: boolean;
      isWhitelabel?: boolean;
      logRetentionInDays?: number;
      messageProcessingTimeoutMs?: number;
      enforceSessionExpiry?: boolean;
      allowAuthConfigExport?: boolean;
      allowAuthConfigImport?: boolean;
      collectOperationDescriptionForToolCalls?: boolean;
      useIntegrationNamesForSessionProviderNameTemplates?: boolean;
      dataRetentionLevel?: SessionDataRetentionLevel;
      storeToolCallAttachments?: boolean;
      collectErrors?: boolean;
      projectOid?: bigint;
      skipNetworks?: boolean;
      environments: {
        name: string;
        identifier: string;
        type: EnvironmentType;
        resourceGroupId: string;
        resourceGroupIdentifier: string;
        instanceOid?: bigint;
      }[];
    };
  }) {
    try {
      let existingTenant = await db.tenant.findUnique({
        where: { identifier: d.input.identifier },
        select: {
          id: true,
          logRetentionInDays: true,
          dataRetentionLevel: true,
          collectErrors: true,
          storeToolCallAttachments: true
        }
      });

      let tenant = await db.tenant.upsert({
        where: { identifier: d.input.identifier },
        update: {
          name: d.input.name,
          resourceTenantId: d.input.resourceTenantId,
          resourceTenantIdentifier: d.input.resourceTenantIdentifier,
          onlyAllowTrustedProviders: d.input.onlyAllowTrustedProviders,
          isWhitelabel: d.input.isWhitelabel,
          logRetentionInDays: d.input.logRetentionInDays,
          messageProcessingTimeoutMs: d.input.messageProcessingTimeoutMs,
          enforceSessionExpiry: d.input.enforceSessionExpiry,
          allowAuthConfigExport: d.input.allowAuthConfigExport,
          allowAuthConfigImport: d.input.allowAuthConfigImport,
          collectOperationDescriptionForToolCalls:
            d.input.collectOperationDescriptionForToolCalls,
          useIntegrationNamesForSessionProviderNameTemplates:
            d.input.useIntegrationNamesForSessionProviderNameTemplates,
          dataRetentionLevel: d.input.dataRetentionLevel,
          storeToolCallAttachments: d.input.storeToolCallAttachments,
          collectErrors: d.input.collectErrors
        },
        create: {
          ...getId('tenant'),
          name: d.input.name,
          identifier: d.input.identifier,
          resourceTenantId: d.input.resourceTenantId,
          resourceTenantIdentifier: d.input.resourceTenantIdentifier,
          onlyAllowTrustedProviders: d.input.onlyAllowTrustedProviders,
          isWhitelabel: d.input.isWhitelabel,
          logRetentionInDays: d.input.logRetentionInDays ?? 30,
          messageProcessingTimeoutMs: d.input.messageProcessingTimeoutMs ?? 30000,
          enforceSessionExpiry: d.input.enforceSessionExpiry ?? false,
          allowAuthConfigExport: d.input.allowAuthConfigExport ?? false,
          allowAuthConfigImport: d.input.allowAuthConfigImport ?? false,
          collectOperationDescriptionForToolCalls:
            d.input.collectOperationDescriptionForToolCalls ?? true,
          useIntegrationNamesForSessionProviderNameTemplates:
            d.input.useIntegrationNamesForSessionProviderNameTemplates ?? false,
          dataRetentionLevel: d.input.dataRetentionLevel ?? 'full',
          storeToolCallAttachments: d.input.storeToolCallAttachments ?? true,
          collectErrors: d.input.collectErrors ?? true,

          urlKey: generatePlainId(10).toLowerCase()
        }
      });

      if (d.input.projectOid !== undefined) {
        await linkTenantToProjectMirror({ tenant, projectOid: d.input.projectOid });
      }

      let retentionRelevantFieldsChanged =
        (d.input.logRetentionInDays !== undefined &&
          existingTenant?.logRetentionInDays !== tenant.logRetentionInDays) ||
        (d.input.dataRetentionLevel !== undefined &&
          existingTenant?.dataRetentionLevel !== tenant.dataRetentionLevel) ||
        (d.input.collectErrors !== undefined &&
          existingTenant?.collectErrors !== tenant.collectErrors) ||
        (d.input.storeToolCallAttachments !== undefined &&
          existingTenant?.storeToolCallAttachments !== tenant.storeToolCallAttachments);

      if (retentionRelevantFieldsChanged) {
        await tenantLogRetentionSyncQueue.add(
          { tenantId: tenant.id },
          { id: `tenant-retention-sync:${tenant.id}` }
        );
      }

      let inputEnvironmentIdentifiers = [
        ...new Set(d.input.environments.map(environment => environment.identifier))
      ];
      let existingEnvironments = await db.environment.findMany({
        where: {
          tenantOid: tenant.oid,
          identifier: { in: inputEnvironmentIdentifiers }
        },
        select: { identifier: true }
      });
      let existingEnvironmentIdentifiers = new Set(
        existingEnvironments.map(environment => environment.identifier)
      );

      await db.environment.createMany({
        skipDuplicates: true,
        data: d.input.environments.map(env => ({
          ...getId('environment'),
          tenantOid: tenant.oid,
          name: env.name,
          identifier: env.identifier,
          type: env.type,
          resourceGroupId: env.resourceGroupId,
          resourceGroupIdentifier: env.resourceGroupIdentifier
        }))
      });

      for (let environment of d.input.environments) {
        await db.environment.updateMany({
          where: {
            tenantOid: tenant.oid,
            identifier: environment.identifier
          },
          data: {
            name: environment.name,
            resourceGroupId: environment.resourceGroupId,
            resourceGroupIdentifier: environment.resourceGroupIdentifier
          }
        });
      }

      let environments = await db.environment.findMany({
        where: { tenantOid: tenant.oid }
      });

      let inputInstanceOids = new Map(
        d.input.environments.flatMap(environment =>
          environment.instanceOid === undefined
            ? []
            : [[environment.identifier, environment.instanceOid] as const]
        )
      );

      for (let environment of environments) {
        let instanceOid = inputInstanceOids.get(environment.identifier);
        if (instanceOid === undefined) continue;

        await linkEnvironmentToInstanceMirror({ environment, instanceOid });
      }

      let inputEnvironmentIdentifierSet = new Set(inputEnvironmentIdentifiers);
      let createdEnvironments = environments.filter(
        environment =>
          inputEnvironmentIdentifierSet.has(environment.identifier) &&
          !existingEnvironmentIdentifiers.has(environment.identifier)
      );

      if (!d.input.skipNetworks) {
        await this.ensureNetworksForTenant(tenant);
      }

      if (createdEnvironments.length > 0) {
        await reconcileProviderDeploymentMonitorForEnvironmentQueue.addManyWithOps(
          createdEnvironments.map(environment => ({
            data: { environmentId: environment.id },
            opts: { id: `provider-deployment-monitor-env:${environment.id}` }
          }))
        );
      }

      if (!existingTenant) {
        let solutions = await db.solution.findMany({
          select: {
            id: true
          }
        });

        await reconcileTenantManagedBackingsQueue.addManyWithOps(
          solutions.map(solution => ({
            data: {
              tenantId: tenant.id,
              solutionId: solution.id
            },
            opts: {
              id: `tenant-${tenant.id}-solution-${solution.id}`
            }
          }))
        );
      }

      return await db.tenant.findFirstOrThrow({
        where: { identifier: d.input.identifier },
        include
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        let tenant = await db.tenant.findFirst({
          where: { identifier: d.input.identifier },
          include
        });
        if (tenant) {
          if (d.input.projectOid !== undefined) {
            tenant.projectOid = await linkTenantToProjectMirror({
              tenant,
              projectOid: d.input.projectOid
            });
          }

          let environments = await db.environment.findMany({
            where: { tenantOid: tenant.oid }
          });
          let inputInstanceOids = new Map(
            d.input.environments.flatMap(environment =>
              environment.instanceOid === undefined
                ? []
                : [[environment.identifier, environment.instanceOid] as const]
            )
          );
          for (let environment of environments) {
            let instanceOid = inputInstanceOids.get(environment.identifier);
            if (instanceOid === undefined) continue;
            await linkEnvironmentToInstanceMirror({ environment, instanceOid });
          }

          return tenant;
        }
      }

      throw error;
    }
  }

  async ensureNetworksForTenant(tenant: Tenant) {
    let environments = await db.environment.findMany({
      where: { tenantOid: tenant.oid }
    });
    for (let environment of environments) {
      await networkInternalService.ensureNetworkForEnvironment({ tenant, environment });
    }
  }

  async getTenantById(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] },
      include
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    return tenant;
  }

  async getTenantAndEnvironmentById(d: { tenantId: string; environmentId: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] },
      include: {
        environments: {
          where: { OR: [{ id: d.environmentId }, { identifier: d.environmentId }] }
        }
      }
    });
    let environment = tenant?.environments[0];

    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    if (!environment) throw new ServiceError(notFoundError('environment'));

    return {
      tenant,
      environment
    };
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
