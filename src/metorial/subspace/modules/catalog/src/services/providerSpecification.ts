import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter, resolveProviders } from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { getProviderTenantFilter } from './provider';

type ListProviderSpecificationsParams = {
  ids?: string[];
  providerIds?: string[];
  providerVersionIds?: string[];
  providerDeploymentIds?: string[];
  providerConfigIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
  includeDeprecated?: boolean;
};

type GetProviderSpecificationByIdParams = {
  providerSpecificationId: string;
  includeDeprecated?: boolean;
};

class providerSpecificationServiceImpl {
  async listProviderSpecifications(d: MetorialFacing<ListProviderSpecificationsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderSpecificationsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderSpecificationsInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & ListProviderSpecificationsParams
  ) {
    let solution = await getMetorialSolution();

    let includeDeprecated =
      d.includeDeprecated ||
      !!d.ids?.length ||
      !!d.providerIds?.length ||
      !!d.providerVersionIds?.length ||
      !!d.providerDeploymentIds?.length ||
      !!d.providerConfigIds?.length;
    let providers = await resolveProviders({ ...d, solution }, d.providerIds);

    let versions = d.providerVersionIds
      ? await db.providerVersion.findMany({
          where: { id: { in: d.providerVersionIds } }
        })
      : undefined;
    let deployments = d.providerDeploymentIds
      ? await db.providerDeployment.findMany({
          where: { id: { in: d.providerDeploymentIds } },
          include: { currentVersion: { include: { lockedVersion: true } } }
        })
      : undefined;
    let configs = d.providerConfigIds
      ? await db.providerConfig.findMany({
          where: { id: { in: d.providerConfigIds } }
        })
      : undefined;

    let specOids = [
      ...(versions?.map(v => v.specificationOid!).filter(o => o) ?? []),
      ...(deployments
        ?.map(d => d.currentVersion?.lockedVersion?.specificationOid!)
        .filter(o => o) ?? []),
      ...(configs?.map(c => c.specificationOid) ?? [])
    ];

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerSpecification.findMany({
            ...opts,

            where: {
              AND: [
                {
                  provider: getProviderTenantFilter({
                    ...d,
                    solution,
                    includeDeprecated
                  })
                },

                d.ids ? { id: { in: d.ids } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                specOids.length ? { oid: { in: specOids } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },

            include: {
              provider: true,
              providerTools: { where: { adapterOid: null } },
              providerAuthMethods: true,
              providerTriggers: { where: { adapterOid: null } }
            }
          })
      )
    );
  }

  async getProviderSpecificationById(d: MetorialFacing<GetProviderSpecificationByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderSpecificationByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderSpecificationByIdInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & GetProviderSpecificationByIdParams
  ) {
    let solution = await getMetorialSolution();

    let providerSpecification = await db.providerSpecification.findFirst({
      where: {
        provider: getProviderTenantFilter({
          ...d,
          solution,
          includeDeprecated: true
        }),

        id: d.providerSpecificationId
      },
      include: {
        provider: true,
        providerTools: true,
        providerAuthMethods: true,
        providerTriggers: true
      }
    });
    if (!providerSpecification) {
      throw new ServiceError(notFoundError('provider_tool', d.providerSpecificationId));
    }

    return providerSpecification;
  }
}

export let providerSpecificationService = Service.create(
  'providerSpecificationService',
  () => new providerSpecificationServiceImpl()
).build();
