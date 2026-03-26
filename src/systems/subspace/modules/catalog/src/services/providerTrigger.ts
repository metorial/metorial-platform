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

class providerTriggerServiceImpl {
  async listProviderTriggers(d: {
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
        let listRes = await db.providerTriggerGlobal.findMany({
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
                  providerTriggers: {
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
            providerTriggers: version?.specificationOid
              ? {
                  where: { specificationOid: version.specificationOid },
                  include: { specification: { omit: { value: true } } }
                }
              : false
          }
        });

        return listRes
          .filter(g => g.currentInstance || g.providerTriggers.length)
          .map(global => {
            let inner = global.providerTriggers?.[0] ?? global.currentInstance!;

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

  async getProviderTriggerById(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;
    providerTriggerId: string;
  }) {
    let providerTrigger = await db.providerTrigger.findFirst({
      where: {
        provider: getProviderTenantFilter(d),

        id: d.providerTriggerId
      },
      include: {
        global: true,
        provider: true,
        specification: { omit: { value: true } }
      }
    });
    if (!providerTrigger) {
      throw new ServiceError(notFoundError('provider_trigger', d.providerTriggerId));
    }

    return providerTrigger;
  }
}

export let providerTriggerService = Service.create(
  'providerTriggerService',
  () => new providerTriggerServiceImpl()
).build();
