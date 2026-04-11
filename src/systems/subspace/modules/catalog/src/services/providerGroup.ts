import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generateCode } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  db,
  type Environment,
  getId,
  type ProviderListing,
  type ProviderListingGroup,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveProviderListings,
  resolveProviders
} from '@metorial-subspace/list-utils';

class ProviderListingGroupService {
  async listProviderListingGroups(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    ids?: string[];
    providerIds?: string[];
    providerListingIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let providerListings = await resolveProviderListings(d, d.providerListingIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerListingGroup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                providers ? { listings: { some: { providerOid: providers.in } } } : undefined!,
                providerListings
                  ? { listings: { some: { oid: providerListings.in } } }
                  : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            }
          })
      )
    );
  }

  async getProviderListingGroupById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerListingGroupId: string;
  }) {
    let providerListingGroup = await db.providerListingGroup.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,

        OR: [{ id: d.providerListingGroupId }, { slug: d.providerListingGroupId }]
      }
    });
    if (!providerListingGroup) {
      throw new ServiceError(notFoundError('provider.group', d.providerListingGroupId));
    }

    return providerListingGroup;
  }

  async createProviderListingGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: { name: string; description?: string };
  }) {
    return await db.providerListingGroup.create({
      data: {
        ...getId('providerGroup'),
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        name: d.input.name,
        description: d.input.description,
        slug: slugify(`${d.input.name}-${generateCode(6)}`)
      }
    });
  }

  async updateProviderListingGroup(d: {
    providerListingGroup: ProviderListingGroup;
    input: {
      name?: string;
      description?: string;
    };
  }) {
    return await db.providerListingGroup.update({
      where: { id: d.providerListingGroup.id },
      data: {
        name: d.input.name,
        description: d.input.description
      }
    });
  }

  async deleteProviderListingGroup(d: { providerListingGroup: ProviderListingGroup }) {
    await db.providerListingGroup.delete({
      where: { id: d.providerListingGroup.id }
    });
  }

  async addProviderToGroup(d: {
    providerListingGroup: ProviderListingGroup;
    providerListing: ProviderListing;
  }) {
    await db.providerListing.update({
      where: { id: d.providerListing.id },
      data: {
        groups: {
          connect: { id: d.providerListingGroup.id }
        }
      },
      include: {
        groups: true
      }
    });
  }

  async removeProviderFromGroup(d: {
    providerListingGroup: ProviderListingGroup;
    providerListing: ProviderListing;
  }) {
    return db.providerListing.update({
      where: { id: d.providerListing.id },
      data: {
        groups: {
          disconnect: { id: d.providerListingGroup.id }
        }
      }
    });
  }
}

export let providerListingGroupService = Service.create(
  'providerListingGroupService',
  () => new ProviderListingGroupService()
).build();
