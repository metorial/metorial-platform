import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type MonitorOwner,
  type MonitorStatus,
  type MonitorTarget,
  type Prisma,
  type Tenant
} from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  normalizeDateFilter,
  resolveProtoGuardFilterOids,
  resolveProviderOids,
  type DateFilter
} from './_shared';

export let monitorInclude = {
  protoGuardFilter: true,
  provider: true
} as const;

export type MonitorWithRelations = Prisma.MonitorGetPayload<{
  include: typeof monitorInclude;
}>;

export type ListMonitorsParams = {
  tenant: Tenant;
  environment: Environment;

  ids?: string[];
  targets?: MonitorTarget[];
  statuses?: MonitorStatus[];
  owners?: MonitorOwner[];
  protoGuardFilterIds?: string[];
  providerIds?: string[];
  search?: string;
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
  firstAlertAt?: DateFilter;
  lastAlertAt?: DateFilter;
};

export type GetMonitorByIdParams = {
  tenant: Tenant;
  environment: Environment;
  monitorId: string;
};

class monitorServiceImpl {
  async listMonitors(d: MetorialFacing<ListMonitorsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listMonitorsInternal({ ...rest, tenant, environment });
  }

  async listMonitorsInternal(d: ListMonitorsParams) {
    let solution = await getMetorialSolution();

    let [protoGuardFilterOids, providerOids] = await Promise.all([
      resolveProtoGuardFilterOids(d.protoGuardFilterIds),
      resolveProviderOids(d.providerIds)
    ]);

    return Paginator.create<MonitorWithRelations>(({ prisma }) =>
      prisma(async opts => {
        let and: Prisma.MonitorWhereInput[] = [
          d.ids ? { id: { in: d.ids } } : undefined!,
          d.targets ? { target: { in: d.targets } } : undefined!,
          d.statuses
            ? { status: { in: d.statuses } }
            : { status: { not: 'archived' as const } },
          d.owners ? { owner: { in: d.owners } } : undefined!,
          protoGuardFilterOids
            ? { protoGuardFilterOid: { in: protoGuardFilterOids } }
            : undefined!,
          providerOids ? { providerOid: { in: providerOids } } : undefined!,
          d.search
            ? {
                OR: [
                  {
                    name: {
                      contains: d.search,
                      mode: 'insensitive' as Prisma.QueryMode
                    }
                  },
                  {
                    description: {
                      contains: d.search,
                      mode: 'insensitive' as Prisma.QueryMode
                    }
                  }
                ]
              }
            : undefined!,
          d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
          d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!,
          d.firstAlertAt ? { firstAlertAt: normalizeDateFilter(d.firstAlertAt) } : undefined!,
          d.lastAlertAt ? { lastAlertAt: normalizeDateFilter(d.lastAlertAt) } : undefined!
        ].filter(Boolean);

        let monitors = await db.monitor.findMany({
          ...opts,
          where: {
            OR: [
              {
                tenantOid: d.tenant.oid,
                solutionOid: solution.oid,
                environmentOid: d.environment.oid
              },
              { owner: 'system' }
            ],
            AND: and
          },
          include: monitorInclude
        });

        return monitors as MonitorWithRelations[];
      })
    );
  }

  async getMonitorById(d: MetorialFacing<GetMonitorByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getMonitorByIdInternal({ ...rest, tenant, environment });
  }

  async getMonitorByIdInternal(d: GetMonitorByIdParams) {
    let solution = await getMetorialSolution();
    let monitor = await db.monitor.findFirst({
      where: {
        id: d.monitorId,
        OR: [
          {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid
          },
          { owner: 'system' }
        ]
      },
      include: monitorInclude
    });
    if (!monitor) throw new ServiceError(notFoundError('monitor', d.monitorId));

    return monitor;
  }
}

export let monitorService = Service.create(
  'monitorService',
  () => new monitorServiceImpl()
).build();
