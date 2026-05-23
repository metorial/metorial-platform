import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter, resolveProviders } from '@metorial-subspace/list-utils';
import { getProviderTenantFilter } from './provider';
import { providerVariantInclude } from './providerVariant';

let include = {
  provider: true,
  providerVariant: { include: providerVariantInclude },
  slate: true,
  slateVersion: true,
  specification: true
};

class providerVersionServiceImpl {
  async listProviderVersions(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;

    ids?: string[];
    providerIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
    includeDeprecated?: boolean;
  }) {
    let includeDeprecated = d.includeDeprecated || !!d.ids?.length || !!d.providerIds?.length;
    let providers = await resolveProviders(d, d.providerIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerVersion.findMany({
            ...opts,
            where: {
              provider: getProviderTenantFilter({
                ...d,
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

  async getProviderVersionById(d: {
    providerVersionId: string;
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;
    includeDeprecated?: boolean;
  }) {
    let providerVersion = await db.providerVersion.findFirst({
      where: {
        provider: getProviderTenantFilter({
          ...d,
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
