import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { db, type EnvironmentType, getId } from '@metorial-subspace/db';
import { reconcileTenantManagedBackingsQueue } from '@metorial-subspace/module-auth/src/queues/reconcile';
import { tenantLogRetentionSyncQueue } from '../queues/retention/sync';

let include = {};

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
      onlyAllowTrustedProviders?: boolean;
      isWhitelabel?: boolean;
      logRetentionInDays?: number;
      enforceSessionExpiry?: boolean;
      allowAuthConfigExport?: boolean;
      allowAuthConfigImport?: boolean;
      collectOperationDescriptionForToolCalls?: boolean;
      environments: {
        name: string;
        identifier: string;
        type: EnvironmentType;
      }[];
    };
  }) {
    try {
      let existingTenant = await db.tenant.findUnique({
        where: { identifier: d.input.identifier },
        select: {
          id: true,
          logRetentionInDays: true
        }
      });

      let tenant = await db.tenant.upsert({
        where: { identifier: d.input.identifier },
        update: {
          name: d.input.name,
          onlyAllowTrustedProviders: d.input.onlyAllowTrustedProviders,
          isWhitelabel: d.input.isWhitelabel,
          logRetentionInDays: d.input.logRetentionInDays,
          enforceSessionExpiry: d.input.enforceSessionExpiry,
          allowAuthConfigExport: d.input.allowAuthConfigExport,
          allowAuthConfigImport: d.input.allowAuthConfigImport,
          collectOperationDescriptionForToolCalls:
            d.input.collectOperationDescriptionForToolCalls
        },
        create: {
          ...getId('tenant'),
          name: d.input.name,
          identifier: d.input.identifier,
          onlyAllowTrustedProviders: d.input.onlyAllowTrustedProviders,
          isWhitelabel: d.input.isWhitelabel,
          logRetentionInDays: d.input.logRetentionInDays ?? 30,
          enforceSessionExpiry: d.input.enforceSessionExpiry ?? false,
          allowAuthConfigExport: d.input.allowAuthConfigExport ?? false,
          allowAuthConfigImport: d.input.allowAuthConfigImport ?? false,
          collectOperationDescriptionForToolCalls:
            d.input.collectOperationDescriptionForToolCalls ?? true,

          urlKey: generatePlainId(10).toLowerCase()
        }
      });

      if (
        d.input.logRetentionInDays !== undefined &&
        existingTenant?.logRetentionInDays !== tenant.logRetentionInDays
      ) {
        await tenantLogRetentionSyncQueue.add(
          { tenantId: tenant.id },
          { id: `tenant-retention-sync:${tenant.id}` }
        );
      }

      await db.environment.createMany({
        skipDuplicates: true,
        data: d.input.environments.map(env => ({
          ...getId('environment'),
          tenantOid: tenant.oid,
          name: env.name,
          identifier: env.identifier,
          type: env.type
        }))
      });

      let environments = await db.environment.findMany({
        where: { tenantOid: tenant.oid }
      });

      let { networkInternalService } = await import('@metorial-subspace/module-enclave');
      for (let environment of environments) {
        await networkInternalService.ensureNetworkForEnvironment({ tenant, environment });
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
        if (tenant) return tenant;
      }

      throw error;
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
