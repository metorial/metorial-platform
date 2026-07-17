import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillMarketplaces,
  resolveSkillPlugins
} from '@metorial/cargo-list-utils';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import type { Prisma, SkillDestinationSyncStatus } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';

export let skillSyncInclude = {
  destination: {
    include: {
      skillMarketplace: {
        select: {
          id: true,
          resourceTenantOid: true,
          resourceGroupOid: true
        }
      },
      skillPlugin: {
        select: {
          id: true,
          resourceTenantOid: true,
          resourceGroupOid: true
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
    d: ResourceScope & {
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

  private scopeDestinationWhere(d: ResourceScope): Prisma.SkillDestinationWhereInput {
    return {
      OR: [
        {
          skillMarketplace: {
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid
          }
        },
        {
          skillPlugin: {
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid
          }
        }
      ]
    };
  }

  async listSkillSyncs(
    d: ResourceScope & {
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
              status: d.statuses?.length ? { in: d.statuses } : { not: 'canceled' },
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
    d: ResourceScope & {
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
