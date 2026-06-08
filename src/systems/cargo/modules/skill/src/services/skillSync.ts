import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, SkillDestinationSyncStatus } from '@metorial-cargo/db';
import { db, withTransaction } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillMarketplaces,
  resolveSkillPlugins
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';

export let skillSyncInclude = {
  destination: {
    include: {
      skillMarketplace: {
        select: {
          id: true,
          tenantOid: true,
          environmentOid: true
        }
      },
      skillPlugin: {
        select: {
          id: true,
          tenantOid: true,
          environmentOid: true
        }
      }
    }
  },
  repositoryPropagations: {
    orderBy: {
      createdAt: 'asc'
    },
    include: {
      skillRepository: true
    }
  }
} satisfies Prisma.SkillDestinationSyncInclude;

export type SkillSyncRecord = Prisma.SkillDestinationSyncGetPayload<{
  include: typeof skillSyncInclude;
}>;

export type SkillSyncStatusFilter = SkillDestinationSyncStatus;

class SkillSyncServiceImpl {
  private async getSkillSyncRecord(
    d: CargoTenantEnvironment & {
      skillSyncId: string;
    }
  ) {
    return await withTransaction(
      async db => {
        let skillSync = await db.skillDestinationSync.findFirst({
          where: {
            id: d.skillSyncId,
            destination: this.scopeDestinationWhere(d)
          },
          include: skillSyncInclude
        });

        if (!skillSync) {
          throw new ServiceError(notFoundError('skill.sync', d.skillSyncId));
        }

        return skillSync;
      },
      { ifExists: true }
    );
  }

  private scopeDestinationWhere(d: CargoTenantEnvironment): Prisma.SkillDestinationWhereInput {
    return {
      OR: [
        {
          skillMarketplace: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
          }
        },
        {
          skillPlugin: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
          }
        }
      ]
    };
  }

  async listSkillSyncs(
    d: CargoTenantEnvironment & {
      ids?: string[];
      skillMarketplaceIds?: string[];
      skillPluginIds?: string[];
      statuses?: SkillSyncStatusFilter[];
      createdAt?: DateFilter;
    }
  ) {
    let skillMarketplaces = await resolveSkillMarketplaces(d, d.skillMarketplaceIds);
    let skillPlugins = await resolveSkillPlugins(d, d.skillPluginIds);
    let destinationFilters: Prisma.SkillDestinationWhereInput[] = [];

    if (skillMarketplaces) {
      destinationFilters.push({ skillMarketplace: { oid: skillMarketplaces.in } });
    }
    if (skillPlugins) {
      destinationFilters.push({ skillPlugin: { oid: skillPlugins.in } });
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillDestinationSync.findMany({
            ...opts,
            where: {
              id: d.ids?.length ? { in: d.ids } : undefined,
              status: d.statuses?.length ? { in: d.statuses } : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              destination: {
                AND: [
                  this.scopeDestinationWhere(d),
                  destinationFilters.length ? { OR: destinationFilters } : undefined!
                ].filter(Boolean)
              }
            },
            include: skillSyncInclude
          })
      )
    );
  }

  async getSkillSyncById(
    d: CargoTenantEnvironment & {
      skillSyncId: string;
    }
  ) {
    return await this.getSkillSyncRecord(d);
  }
}

export let skillSyncService = Service.create(
  'cargoSkillSyncService',
  () => new SkillSyncServiceImpl()
).build();
