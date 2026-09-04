import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generateCode } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import type { AuditScope } from '@metorial/audit-scope';
import type { Instance } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  db,
  type Environment,
  getId,
  type ProviderListing,
  type ProviderListingGroup,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveProviderListings,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';

type ListProviderListingGroupsParams = {
  ids?: string[];
  providerIds?: string[];
  providerListingIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetProviderListingGroupByIdParams = {
  providerListingGroupId: string;
};

type CreateProviderListingGroupParams = {
  input: { name: string; description?: string };
};

type UpdateProviderListingGroupParams = {
  providerListingGroup: ProviderListingGroup;
  input: {
    name?: string;
    description?: string;
  };
};

type DeleteProviderListingGroupParams = {
  providerListingGroup: ProviderListingGroup;
};

class ProviderListingGroupService {
  async listProviderListingGroups(d: MetorialFacing<ListProviderListingGroupsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderListingGroupsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderListingGroupsInternal(
    d: { tenant: Tenant; environment: Environment } & ListProviderListingGroupsParams
  ) {
    let solution = await getMetorialSolution();

    let providers = await resolveProviders(
      { tenant: d.tenant, solution, environment: d.environment },
      d.providerIds
    );
    let providerListings = await resolveProviderListings(
      { tenant: d.tenant, solution, environment: d.environment },
      d.providerListingIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerListingGroup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
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

  async getProviderListingGroupById(d: MetorialFacing<GetProviderListingGroupByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderListingGroupByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderListingGroupByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderListingGroupByIdParams
  ) {
    let solution = await getMetorialSolution();

    let providerListingGroup = await db.providerListingGroup.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,

        OR: [{ id: d.providerListingGroupId }, { slug: d.providerListingGroupId }]
      }
    });
    if (!providerListingGroup) {
      throw new ServiceError(notFoundError('provider.group', d.providerListingGroupId));
    }

    return providerListingGroup;
  }

  async createProviderListingGroup(d: MetorialFacing<CreateProviderListingGroupParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.provider_listing_group.created:before', eventBase);

    let providerGroup = await this.createProviderListingGroupInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.provider_listing_group.created:after', {
      ...eventBase,
      providerGroup
    });

    return providerGroup;
  }

  async createProviderListingGroupInternal(
    d: { tenant: Tenant; environment: Environment } & CreateProviderListingGroupParams
  ) {
    let solution = await getMetorialSolution();

    return await db.providerListingGroup.create({
      data: {
        ...getId('providerGroup'),
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid,
        name: d.input.name,
        description: d.input.description,
        slug: slugify(`${d.input.name}-${generateCode(6)}`)
      }
    });
  }

  async updateProviderListingGroup(d: MetorialFacing<UpdateProviderListingGroupParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.provider_listing_group.updated:before', eventBase);

    let providerGroup = await this.updateProviderListingGroupInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.provider_listing_group.updated:after', {
      ...eventBase,
      providerGroup,
      previousProviderGroup: d.providerListingGroup
    });

    return providerGroup;
  }

  async updateProviderListingGroupInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateProviderListingGroupParams
  ) {
    checkTenant(d, d.providerListingGroup);

    return await db.providerListingGroup.update({
      where: { id: d.providerListingGroup.id },
      data: {
        name: d.input.name,
        description: d.input.description
      }
    });
  }

  async deleteProviderListingGroup(d: MetorialFacing<DeleteProviderListingGroupParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.provider_listing_group.deleted:before', eventBase);

    let providerGroup = await this.deleteProviderListingGroupInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.provider_listing_group.deleted:after', {
      ...eventBase,
      providerGroup
    });

    return providerGroup;
  }

  async deleteProviderListingGroupInternal(
    d: { tenant: Tenant; environment: Environment } & DeleteProviderListingGroupParams
  ) {
    checkTenant(d, d.providerListingGroup);

    await db.providerListingGroup.delete({
      where: { id: d.providerListingGroup.id }
    });

    return d.providerListingGroup;
  }

  async addProviderToGroup(d: {
    providerListingGroup: ProviderListingGroup;
    providerListing: ProviderListing & { provider: { id: string; name: string } };
    instance: Instance;
    auditScope?: AuditScope;
  }) {
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.provider_listing_group.listing.added:before', eventBase);

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

    await Fabric.fire('provider.provider_listing_group.listing.added:after', {
      ...eventBase,
      providerGroup: d.providerListingGroup,
      providerListing: {
        id: d.providerListing.id,
        provider: { id: d.providerListing.provider.id, name: d.providerListing.provider.name }
      }
    });
  }

  async removeProviderFromGroup(d: {
    providerListingGroup: ProviderListingGroup;
    providerListing: ProviderListing & { provider: { id: string; name: string } };
    instance: Instance;
    auditScope?: AuditScope;
  }) {
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.provider_listing_group.listing.removed:before', eventBase);

    let providerListing = await db.providerListing.update({
      where: { id: d.providerListing.id },
      data: {
        groups: {
          disconnect: { id: d.providerListingGroup.id }
        }
      }
    });

    await Fabric.fire('provider.provider_listing_group.listing.removed:after', {
      ...eventBase,
      providerGroup: d.providerListingGroup,
      providerListing: {
        id: d.providerListing.id,
        provider: { id: d.providerListing.provider.id, name: d.providerListing.provider.name }
      }
    });

    return providerListing;
  }
}

export let providerListingGroupService = Service.create(
  'providerListingGroupService',
  () => new ProviderListingGroupService()
).build();
