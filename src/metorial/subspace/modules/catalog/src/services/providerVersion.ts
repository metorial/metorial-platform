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
import { providerVariantInclude } from './providerVariant';

let include = {
  provider: true,
  providerVariant: { include: providerVariantInclude },
  slate: true,
  slateVersion: true,
  specification: true
};

type ListProviderVersionsParams = {
  ids?: string[];
  providerIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
  includeDeprecated?: boolean;
};

type GetProviderVersionByIdParams = {
  providerVersionId: string;
  includeDeprecated?: boolean;
};

class providerVersionServiceImpl {
  async listProviderVersions(d: MetorialFacing<ListProviderVersionsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderVersionsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderVersionsInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & ListProviderVersionsParams
  ) {
    let solution = await getMetorialSolution();

    let includeDeprecated = d.includeDeprecated || !!d.ids?.length || !!d.providerIds?.length;
    let providers = await resolveProviders({ ...d, solution }, d.providerIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerVersion.findMany({
            ...opts,
            where: {
              provider: getProviderTenantFilter({
                ...d,
                solution,
                includeDeprecated
              }),

              OR: [
                { isEnvironmentLocked: false },
                d.environment
                  ? {
                      providerEnvironmentVersions: {
                        some: { environmentOid: d.environment.oid }
                      }
                    }
                  : undefined!
              ].filter(Boolean),

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderVersionById(d: MetorialFacing<GetProviderVersionByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderVersionByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderVersionByIdInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & GetProviderVersionByIdParams
  ) {
    let solution = await getMetorialSolution();

    let providerVersion = await db.providerVersion.findFirst({
      where: {
        provider: getProviderTenantFilter({
          ...d,
          solution,
          includeDeprecated: true
        }),

        OR: [
          { isEnvironmentLocked: false },
          {
            providerEnvironmentVersions: { some: { environmentOid: d.environment?.oid } }
          }
        ],

        AND: [
          {
            OR: [{ id: d.providerVersionId }, { identifier: d.providerVersionId }]
          }
        ]
      },
      include
    });
    if (!providerVersion) {
      throw new ServiceError(notFoundError('provider.version', d.providerVersionId));
    }

    return providerVersion;
  }
}

export let providerVersionService = Service.create(
  'providerVersionService',
  () => new providerVersionServiceImpl()
).build();
