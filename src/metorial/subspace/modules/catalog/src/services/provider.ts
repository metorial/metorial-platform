import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type EntityImage,
  type Environment,
  type Provider,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import type { ProviderTypeWhereInput } from '@metorial-subspace/db/prisma/generated/models';
import { providerInternalService } from '@metorial-subspace/module-provider-internal';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { providerVariantInclude } from './providerVariant';

let include = {
  entry: true,
  publisher: true,
  ownerTenant: true,
  defaultVariant: {
    include: providerVariantInclude
  },
  type: true
};

export let providerInclude = include;

export let getProviderEnvironmentVisibilityFilter = (d: { environment?: Environment }) =>
  d.environment
    ? {
        OR: [
          { hasEnvironments: false },
          {
            providerEnvironments: {
              some: {
                environmentOid: d.environment.oid,
                currentVersionOid: { not: null }
              }
            }
          }
        ]
      }
    : undefined!;

export let getProviderTenantFilter = (d: {
  solution: Solution;
  tenant?: Tenant;
  environment?: Environment;
  includeDeprecated?: boolean;
}) => ({
  AND: [
    d.includeDeprecated ? undefined! : { isDeprecated: false },
    getProviderEnvironmentVisibilityFilter(d),
    {
      OR: [
        { access: 'public' as const },
        d.environment && d.tenant
          ? {
              access: 'tenant' as const,
              ownerTenantOid: d.tenant.oid,
              OR: [{ ownerSolutionOid: d.solution.oid }, { ownerSolutionOid: null }]
            }
          : undefined!
      ].filter(Boolean)
    },

    d.tenant?.onlyAllowTrustedProviders
      ? {
          OR: [
            { access: 'tenant' as const },
            { listing: { isVerified: true } },
            { listing: { isOfficial: true } },
            { listing: { isMetorial: true } }
          ]
        }
      : undefined!
  ].filter(Boolean)
});

export type ProviderCapabilityFilter = {
  supportsConfig?: boolean;
  supportsAuth?: boolean;
  supportsOAuth?: boolean;
  supportsCallbacks?: boolean;
  supportsOAuthAutoRegistration?: boolean;
  supportsAuthExport?: boolean;
  supportsAuthImport?: boolean;
};

let isSet = (v: any): v is boolean => typeof v === 'boolean';

export let getProviderCapabilityFilter = (d: ProviderCapabilityFilter) => {
  let filters: Partial<ProviderTypeWhereInput>[] = [];

  if (isSet(d.supportsConfig)) filters.push({ supportsConfig: d.supportsConfig });
  if (isSet(d.supportsAuth)) filters.push({ supportsAuth: d.supportsAuth });
  if (isSet(d.supportsOAuth)) filters.push({ supportsOAuth: d.supportsOAuth });
  if (isSet(d.supportsCallbacks)) filters.push({ supportsCallbacks: d.supportsCallbacks });
  if (isSet(d.supportsOAuthAutoRegistration))
    filters.push({ supportsOAuthAutoRegistration: d.supportsOAuthAutoRegistration });
  if (isSet(d.supportsAuthExport)) filters.push({ supportsAuthExport: d.supportsAuthExport });
  if (isSet(d.supportsAuthImport)) filters.push({ supportsAuthImport: d.supportsAuthImport });

  if (filters.length === 0) return undefined;

  return {
    AND: filters
  };
};

type GetProviderByIdParams = {
  providerId: string;
  includeDeprecated?: boolean;
};

type ListProvidersParams = {
  search?: string;
  ids?: string[];
  capabilities?: ProviderCapabilityFilter;
  includeDeprecated?: boolean;
};

class providerServiceImpl {
  async getProviderById(d: MetorialFacing<GetProviderByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderByIdInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & GetProviderByIdParams
  ) {
    let solution = await getMetorialSolution();

    let provider = await db.provider.findFirst({
      where: {
        AND: [
          getProviderTenantFilter({
            ...d,
            solution,
            includeDeprecated: true
          }),

          {
            OR: [
              { id: d.providerId },
              { slug: d.providerId },
              { globalIdentifier: d.providerId },
              { listing: { id: d.providerId } },
              { listing: { slug: d.providerId } },
              { listing: { prettySlug: d.providerId } },
              { listing: { aliases: { has: d.providerId } } }
            ]
          }
        ].filter(Boolean)
      },
      include
    });
    if (!provider) {
      throw new ServiceError(notFoundError('provider', d.providerId));
    }

    return provider;
  }

  async listProviders(d: MetorialFacing<ListProvidersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProvidersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProvidersInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & ListProvidersParams
  ) {
    let solution = await getMetorialSolution();

    let capFilters = getProviderCapabilityFilter(d.capabilities || {});
    let includeDeprecated = d.includeDeprecated || !!d.ids?.length;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.provider.findMany({
            ...opts,
            where: {
              AND: [
                { status: 'active' },
                getProviderTenantFilter({
                  ...d,
                  solution,
                  includeDeprecated
                }),
                {
                  AND: [
                    d.ids
                      ? {
                          OR: [
                            { id: { in: d.ids } },
                            { slug: { in: d.ids } },
                            { globalIdentifier: { in: d.ids } },
                            { listing: { id: { in: d.ids } } },
                            { listing: { slug: { in: d.ids } } },
                            { listing: { prettySlug: { in: d.ids } } },
                            { listing: { aliases: { hasSome: d.ids } } }
                          ]
                        }
                      : undefined!,
                    capFilters ? { type: capFilters } : undefined!
                  ].filter(Boolean)
                }
              ]
            },
            include
          })
      )
    );
  }

  async updateProvider(d: {
    provider: Provider;
    input: {
      name?: string;
      description?: string;
      readme?: string;
      slug?: string;
      aliases?: string[];
      image?: EntityImage | null;
      skills?: string[];
      access?: 'public' | 'tenant';
      status?: 'active' | 'archived' | 'deleted';
      isDeprecated?: boolean;
      isPublic?: boolean;
      isMetorial?: boolean;
      isVerified?: boolean;
      isOfficial?: boolean;
      rank?: number;
    };
  }) {
    await providerInternalService.updateProvider({
      provider: d.provider,
      input: {
        name: d.input.name?.trim() || undefined,
        description: d.input.description?.trim() || undefined,
        readme: d.input.readme,
        slug: d.input.slug,
        aliases: d.input.aliases,
        image: d.input.image,
        skills: d.input.skills,
        access: d.input.access,
        status: d.input.status,
        isDeprecated: d.input.isDeprecated,
        isPublic: d.input.isPublic,
        isMetorial: d.input.isMetorial,
        isVerified: d.input.isVerified,
        isOfficial: d.input.isOfficial,
        rank: d.input.rank
      }
    });

    return await db.provider.findFirstOrThrow({
      where: { id: d.provider.id },
      include
    });
  }
}

export let providerService = Service.create(
  'providerService',
  () => new providerServiceImpl()
).build();
