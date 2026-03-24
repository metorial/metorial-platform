import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveProviderCategories,
  resolveProviderCollections,
  resolveProviderGroups,
  resolvePublishers
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { providerInclude } from './provider';

export type ProviderListingOrderByUse =
  | 'deployments'
  | 'configs'
  | 'authConfigs'
  | 'credentials'
  | 'sessions'
  | 'sessionTemplates'
  | 'lastUseAt'
  | 'firstDeploymentAt'
  | 'firstConfigAt'
  | 'firstAuthConfigAt'
  | 'firstCredentialAt'
  | 'firstSessionAt'
  | 'firstSessionTemplateAt'
  | 'lastDeploymentAt'
  | 'lastConfigAt'
  | 'lastAuthConfigAt'
  | 'lastCredentialAt'
  | 'lastSessionAt'
  | 'lastSessionTemplateAt';

let getInclude = (tenant: Tenant | undefined, solution: Solution) => ({
  categories: true,
  collections: true,
  groups: tenant
    ? {
        where: { tenantOid: tenant.oid, solutionOid: solution.oid }
      }
    : false,

  publisher: true,

  provider: {
    include: providerInclude
  }
});

class ProviderListingService {
  async getProviderListingById(d: {
    providerListingId: string;
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;
  }) {
    let providerListing = await db.providerListing.findFirst({
      where: {
        AND: [
          {
            OR: [
              { id: d.providerListingId },
              { slug: d.providerListingId },
              { provider: { id: d.providerListingId } },
              { provider: { globalIdentifier: d.providerListingId } }
            ]
          },

          {
            OR: [
              { isPublic: true },
              d.tenant && d.environment
                ? {
                    ownerTenantOid: d.tenant.oid,
                    OR: [{ ownerSolutionOid: d.solution.oid }, { ownerSolutionOid: null }]
                  }
                : undefined!
            ].filter(Boolean)
          }
        ]
      },
      include: getInclude(d.tenant, d.solution)
    });
    if (!providerListing) {
      throw new ServiceError(notFoundError('provider.listing', d.providerListingId));
    }

    return providerListing;
  }

  async listProviderListings(d: {
    search?: string;

    ids?: string[];
    providerCollectionIds?: string[];
    providerCategoryIds?: string[];
    providerGroupIds?: string[];
    publisherIds?: string[];

    isPublic?: boolean;
    onlyFromTenant?: boolean;

    isVerified?: boolean;
    isOfficial?: boolean;
    isMetorial?: boolean;

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;

    orderByRank?: boolean;
    orderByUse?: ProviderListingOrderByUse;
  }) {
    let collections = await resolveProviderCollections(d.providerCollectionIds);
    let categories = await resolveProviderCategories(d.providerCategoryIds);
    let publishers = await resolvePublishers(d.publisherIds);

    let groups =
      d.environment && d.tenant
        ? await resolveProviderGroups(d as any, d.providerGroupIds)
        : undefined;

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let orderByUse = d.orderByUse && d.tenant && d.environment ? d.orderByUse : undefined;

    let useOrderMap: Map<bigint, number> | undefined;
    if (orderByUse) {
      let providerUses = await db.providerUse.findMany({
        where: {
          tenantOid: d.tenant!.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment!.oid
        },
        orderBy: { [orderByUse]: 'desc' },
        select: { providerOid: true },
        take: 500
      });

      useOrderMap = new Map(providerUses.map((pu, i) => [pu.providerOid, i]));
    }

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let search = d.search
          ? await voyager.record.search({
              tenantId: d.tenant?.id,
              sourceId: (await voyagerSource).id,
              indexId: voyagerIndex.providerListing.id,
              query: d.search
            })
          : null;

        let listings = await db.providerListing.findMany({
          ...opts,

          orderBy: [
            d.orderByRank || useOrderMap ? { rank: 'desc' as const } : undefined!,
            ...opts.orderBy
          ].filter(Boolean),

          where: {
            status: 'active',

            AND: [
              {
                OR: [
                  { isPublic: true },
                  d.tenant && d.environment
                    ? {
                        ownerTenantOid: d.tenant.oid,
                        OR: [{ ownerSolutionOid: d.solution.oid }, { ownerSolutionOid: null }]
                      }
                    : undefined!
                ].filter(Boolean)
              },

              d.ids ? { id: { in: d.ids } } : undefined!,

              search ? { id: { in: search.map(r => r.documentId) } } : undefined!,

              collections ? { collections: { some: collections.oidIn } } : undefined!,
              categories ? { categories: { some: categories.oidIn } } : undefined!,
              groups ? { groups: { some: groups.oidIn } } : undefined!,

              publishers ? { publisherOid: publishers.in } : undefined!,

              d.onlyFromTenant && d.tenant && d.solution
                ? {
                    ownerTenantOid: d.tenant.oid,
                    ownerSolutionOid: d.solution.oid
                  }
                : undefined!,

              d.isPublic ? { isPublic: true } : undefined!,

              d.isVerified !== undefined ? { isVerified: d.isVerified } : undefined!,
              d.isOfficial !== undefined ? { isOfficial: d.isOfficial } : undefined!,
              d.isMetorial !== undefined ? { isMetorial: d.isMetorial } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include: getInclude(d.tenant, d.solution),
          omit: {
            readme: true
          }
        });

        if (useOrderMap) {
          listings.sort((a, b) => {
            let aHasUse = useOrderMap.has(a.providerOid);
            let bHasUse = useOrderMap.has(b.providerOid);

            if (aHasUse && !bHasUse) return -1;
            if (!aHasUse && bHasUse) return 1;

            if (aHasUse && bHasUse) {
              return useOrderMap.get(a.providerOid)! - useOrderMap.get(b.providerOid)!;
            }

            // Both without use — preserve rank desc order from DB
            return 0;
          });
        }

        return listings;
      })
    );
  }
}

export let providerListingService = Service.create(
  'providerListingService',
  () => new ProviderListingService()
).build();
