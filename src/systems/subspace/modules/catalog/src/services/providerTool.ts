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

class providerToolServiceImpl {
  async listProviderTools(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;

    providerVersion: ProviderVersion;
  }) {
    let versionOid = d.providerVersion?.oid;

    let version = versionOid
      ? await db.providerVersion.findFirstOrThrow({
          where: { oid: versionOid }
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let listRes = await db.providerToolGlobal.findMany({
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
                  providerTools: {
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
            providerTools: version?.specificationOid
              ? {
                  where: { specificationOid: version.specificationOid },
                  include: { specification: { omit: { value: true } } }
                }
              : false
          }
        });

        return listRes
          .filter(g => g.currentInstance || g.providerTools.length)
          .map(global => {
            let inner = global.providerTools?.[0] ?? global.currentInstance!;

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

  async getProviderToolById(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;
    providerToolId: string;
  }) {
    let providerTool = await db.providerTool.findFirst({
      where: {
        provider: getProviderTenantFilter(d),

        id: d.providerToolId
      },
      include: {
        global: true,
        provider: true,
        specification: { omit: { value: true } }
      }
    });
    if (!providerTool) {
      throw new ServiceError(notFoundError('provider_tool', d.providerToolId));
    }

    return providerTool;
  }
}

export let providerToolService = Service.create(
  'providerToolService',
  () => new providerToolServiceImpl()
).build();
