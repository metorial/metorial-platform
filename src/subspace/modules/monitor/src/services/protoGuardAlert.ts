import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db } from '@metorial-subspace/db';
import {
  normalizeDateFilter,
  resolveProtoGuardFilterOids,
  resolveProtoGuardRunOids,
  resolveProviderRunOids,
  resolveSessionConnectionOids,
  resolveSessionMessageOids,
  resolveSessionOids,
  type DateFilter,
  type Scope
} from './_shared';

export let protoGuardAlertInclude = {
  run: true,
  session: true,
  message: true,
  connection: true,
  providerRun: true,
  instances: {
    include: { filter: true }
  }
} as const;

let getProtoGuardAlertById = async (d: Scope & { alertId: string }) => {
  let alert = await db.protoGuardAlert.findFirst({
    where: {
      id: d.alertId,
      tenantOid: d.tenant.oid,
      environmentOid: d.environment.oid,
      solutionOid: d.solution.oid
    },
    include: protoGuardAlertInclude
  });
  if (!alert) throw new ServiceError(notFoundError('protoguard alert', d.alertId));

  return alert;
};

class protoGuardAlertServiceImpl {
  async listAlerts(
    d: Scope & {
      ids?: string[];
      runIds?: string[];
      filterIds?: string[];
      sessionIds?: string[];
      sessionMessageIds?: string[];
      sessionConnectionIds?: string[];
      providerRunIds?: string[];
      createdAt?: DateFilter;
    }
  ) {
    let [
      runOids,
      filterOids,
      sessionOids,
      sessionMessageOids,
      sessionConnectionOids,
      providerRunOids
    ] = await Promise.all([
      resolveProtoGuardRunOids(d.runIds, d),
      resolveProtoGuardFilterOids(d.filterIds),
      resolveSessionOids(d.sessionIds, d),
      resolveSessionMessageOids(d.sessionMessageIds, d),
      resolveSessionConnectionOids(d.sessionConnectionIds, d),
      resolveProviderRunOids(d.providerRunIds, d)
    ]);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.protoGuardAlert.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            solutionOid: d.solution.oid,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              runOids ? { runOid: { in: runOids } } : undefined!,
              filterOids
                ? { instances: { some: { filterOid: { in: filterOids } } } }
                : undefined!,
              sessionOids ? { sessionOid: { in: sessionOids } } : undefined!,
              sessionMessageOids ? { messageOid: { in: sessionMessageOids } } : undefined!,
              sessionConnectionOids
                ? { connectionOid: { in: sessionConnectionOids } }
                : undefined!,
              providerRunOids ? { providerRunOid: { in: providerRunOids } } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
            ].filter(Boolean)
          },
          include: protoGuardAlertInclude
        });
      })
    );
  }

  async getAlertById(d: Scope & { alertId: string }) {
    return await getProtoGuardAlertById(d);
  }
}

export let protoGuardAlertService = Service.create(
  'protoGuardAlertService',
  () => new protoGuardAlertServiceImpl()
).build();
