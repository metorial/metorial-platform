import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type ProviderSpecification,
  type ProviderVersion,
  type Tenant
} from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { getProviderTenantFilter } from './provider';

type ListProviderTriggersParams = {
  providerVersion: ProviderVersion;
};

type GetProviderTriggerByIdParams = {
  providerTriggerId: string;
};

class providerTriggerServiceImpl {
  async listProviderTriggers(d: MetorialFacing<ListProviderTriggersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderTriggersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderTriggersInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & ListProviderTriggersParams
  ) {
    let solution = await getMetorialSolution();

    let versionOid = d.providerVersion?.oid;

    let version = versionOid
      ? await db.providerVersion.findFirstOrThrow({
          where: { oid: versionOid }
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        if (version && !version.specificationOid) {
          return [];
        }

        // We need to patch the cursor from the versioned tool to
        // the global one for pagination to work correctly
        if (opts.cursor?.id) {
          let trigger = await db.providerTrigger.findFirst({
            where: {
              provider: getProviderTenantFilter({
                ...d,
                solution,
                includeDeprecated: true
              }),
              OR: [{ id: opts.cursor.id }, { global: { id: opts.cursor.id } }]
            },
            include: {
              global: true
            }
          });

          if (trigger?.global) {
            opts.cursor = { id: trigger.global.id };
          }
        }

        let listRes = await db.providerTriggerGlobal.findMany({
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
                  providerTriggers: {
                    some: { specificationOid: version.specificationOid, adapterOid: null }
                  }
                }
              : {
                  currentInstance: { is: { adapterOid: null } }
                })
          },

          include: {
            provider: true,
            currentInstance: version
              ? false
              : { include: { specification: { omit: { value: true } } } },
            providerTriggers: version?.specificationOid
              ? {
                  where: { specificationOid: version.specificationOid, adapterOid: null },
                  include: { specification: { omit: { value: true } } }
                }
              : false
          }
        });

        return listRes
          .filter(g => g.currentInstance || (g.providerTriggers?.length ?? 0) > 0)
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

  async getProviderTriggerById(d: MetorialFacing<GetProviderTriggerByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderTriggerByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderTriggerByIdInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & GetProviderTriggerByIdParams
  ) {
    let solution = await getMetorialSolution();

    let providerTrigger = await db.providerTrigger.findFirst({
      where: {
        provider: getProviderTenantFilter({
          ...d,
          solution,
          includeDeprecated: true
        }),

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
