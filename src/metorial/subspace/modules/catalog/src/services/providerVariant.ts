import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Provider, type Tenant } from '@metorial-subspace/db';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';
import { getProviderTenantFilter } from './provider';

let include = {
  backend: true,
  publisher: true,
  slate: true,
  currentVersion: { include: { specification: { omit: { value: true } } } },
  provider: true
};

export let providerVariantInclude = include;

class providerVariantServiceImpl {
  async listProviderVariants(d: {
    tenant?: Tenant;
    environment?: Environment;
    includeDeprecated?: boolean;
  }) {
    let solution = await getMetorialSolution();

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerVariant.findMany({
            ...opts,
            where: {
              provider: getProviderTenantFilter({
                ...d,
                solution,
                includeDeprecated: d.includeDeprecated
              })
            },
            include
          })
      )
    );
  }

  async getProviderVariantById(d: {
    providerVariantId: string;
    tenant?: Tenant;
    environment?: Environment;
    provider?: Provider;
    includeDeprecated?: boolean;
  }) {
    let solution = await getMetorialSolution();

    let providerVariant = await db.providerVariant.findFirst({
      where: {
        providerOid: d.provider ? d.provider.oid : undefined,
        provider: getProviderTenantFilter({
          ...d,
          solution,
          includeDeprecated: true
        }),

        AND: [
          {
            OR: [{ id: d.providerVariantId }, { identifier: d.providerVariantId }]
          }
        ]
      },
      include
    });
    if (!providerVariant) {
      throw new ServiceError(notFoundError('provider.variant', d.providerVariantId));
    }

    return providerVariant;
  }
}

export let providerVariantService = Service.create(
  'providerVariantService',
  () => new providerVariantServiceImpl()
).build();
