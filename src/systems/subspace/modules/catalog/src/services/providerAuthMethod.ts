import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type ProviderSpecification,
  type ProviderVersion,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { getProviderTenantFilter } from './provider';

class providerAuthMethodServiceImpl {
  async listProviderAuthMethods(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;
    providerVersion: ProviderVersion;
  }) {
    let versionOid = d.providerVersion?.oid;

    let version = versionOid
      ? await db.providerVersion.findFirst({
          where: { oid: versionOid }
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let listRes = await db.providerAuthMethodGlobal.findMany({
          ...opts,

          where: {
            AND: [
              {
                provider: getProviderTenantFilter(d)
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

  async getProviderAuthMethodById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthMethodId: string;
  }) {
    let providerAuthMethod = await db.providerAuthMethod.findFirst({
      where: {
        provider: getProviderTenantFilter(d),
        id: d.providerAuthMethodId
      },
      include: {
        global: true,
        provider: true,
        specification: { omit: { value: true } }
      }
    });
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
