import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type ProviderSpecification,
  type ProviderVersion,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { getProviderTenantFilter } from './provider';

type ListProviderAuthMethodsParams = {
  providerVersion: ProviderVersion;
  includeDeprecated?: boolean;
};

type GetProviderAuthMethodByIdParams = {
  providerAuthMethodId: string;
  includeDeprecated?: boolean;
};

class providerAuthMethodServiceImpl {
  async listProviderAuthMethods(d: MetorialFacing<ListProviderAuthMethodsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderAuthMethodsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderAuthMethodsInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & ListProviderAuthMethodsParams
  ) {
    let solution = await getMetorialSolution();

    let versionOid = d.providerVersion?.oid;

    let version = versionOid
      ? await db.providerVersion.findFirst({
          where: { oid: versionOid }
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        if (version && !version.specificationOid) {
          return [];
        }

        let listRes = await db.providerAuthMethodGlobal.findMany({
          ...opts,

          where: {
            AND: [
              {
                provider: getProviderTenantFilter({
                  ...d,
                  solution,
                  includeDeprecated: true
                })
              }
            ],
            providerOid: d.providerVersion.providerOid,

            ...(version?.specificationOid
              ? {
                  providerAuthMethods: {
                    some: { specificationOid: version.specificationOid }
                  }
                }
              : {
                  currentInstance: { isNot: null }
                })
          },

          include: {
            provider: true,

            currentInstance: version
              ? false
              : { include: { specification: { omit: { value: true } } } },
            providerAuthMethods: version?.specificationOid
              ? {
                  where: { specificationOid: version.specificationOid },
                  include: { specification: { omit: { value: true } } }
                }
              : false
          }
        });

        return listRes
          .filter(g => g.currentInstance || g.providerAuthMethods?.length)
          .map(global => {
            let inner = global.providerAuthMethods?.[0] ?? global.currentInstance!;

            return {
              ...inner,
              global,
              provider: global.provider,
              specification: (inner as any).specification as ProviderSpecification
            };
          });
      })
    );
  }

  async getProviderAuthMethodById(d: MetorialFacing<GetProviderAuthMethodByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderAuthMethodByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderAuthMethodByIdInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & GetProviderAuthMethodByIdParams
  ) {
    let solution = await getMetorialSolution();

    let providerAuthMethod = await withTransaction(
      async db =>
        await db.providerAuthMethod.findFirst({
          where: {
            provider: getProviderTenantFilter({
              ...d,
              solution,
              includeDeprecated: true
            }),
            id: d.providerAuthMethodId
          },
          include: {
            global: true,
            provider: true,
            specification: { omit: { value: true } }
          }
        }),
      { ifExists: true }
    );
    if (!providerAuthMethod) {
      throw new ServiceError(notFoundError('provider_tool', d.providerAuthMethodId));
    }

    return providerAuthMethod;
  }
}

export let providerAuthMethodService = Service.create(
  'providerAuthMethodService',
  () => new providerAuthMethodServiceImpl()
).build();
