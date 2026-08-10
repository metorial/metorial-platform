import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';

export type Scope = {
  tenant: Tenant;
  environment: Environment;
  solution: Solution;
};

export type DateFilter = {
  gt?: Date;
  gte?: Date;
  lt?: Date;
  lte?: Date;
};

export let normalizeDateFilter = (filter: DateFilter | undefined) => filter;

export let resolveOids = async <T extends { oid: any }>(d: {
  ids: string[] | undefined;
  findMany: (ids: string[]) => Promise<T[]>;
}) => {
  if (!d.ids) return undefined;
  if (d.ids.length === 0) return [];
  return (await d.findMany(d.ids)).map(item => item.oid);
};

export let resolveMonitorOids = (ids: string[] | undefined, scope: Scope) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.monitor.findMany({
        where: {
          id: { in: ids },
          OR: [{ tenantOid: scope.tenant.oid }, { owner: 'system' }]
        },
        select: { oid: true }
      })
  });

export let resolveProviderOids = (ids: string[] | undefined) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.provider.findMany({
        where: { id: { in: ids } },
        select: { oid: true }
      })
  });

export let resolveProtoGuardFilterOids = (ids: string[] | undefined) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.protoGuardFilter.findMany({
        where: { id: { in: ids } },
        select: { oid: true }
      })
  });

export let resolveProtoGuardRunOids = (ids: string[] | undefined, scope: Scope) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.protoGuardRun.findMany({
        where: { id: { in: ids }, tenantOid: scope.tenant.oid },
        select: { oid: true }
      })
  });

export let resolveProtoGuardAlertOids = (ids: string[] | undefined, scope: Scope) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.protoGuardAlert.findMany({
        where: { id: { in: ids }, tenantOid: scope.tenant.oid },
        select: { oid: true }
      })
  });

export let resolveSessionOids = (ids: string[] | undefined, scope: Scope) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.session.findMany({
        where: { id: { in: ids }, tenantOid: scope.tenant.oid },
        select: { oid: true }
      })
  });

export let resolveSessionMessageOids = (ids: string[] | undefined, scope: Scope) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.sessionMessage.findMany({
        where: { id: { in: ids }, tenantOid: scope.tenant.oid },
        select: { oid: true }
      })
  });

export let resolveSessionConnectionOids = (ids: string[] | undefined, scope: Scope) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.sessionConnection.findMany({
        where: { id: { in: ids }, tenantOid: scope.tenant.oid },
        select: { oid: true }
      })
  });

export let resolveProviderRunOids = (ids: string[] | undefined, scope: Scope) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.providerRun.findMany({
        where: { id: { in: ids }, tenantOid: scope.tenant.oid },
        select: { oid: true }
      })
  });

export let resolveSpecNotificationOids = (ids: string[] | undefined, scope: Scope) =>
  resolveOids({
    ids,
    findMany: ids =>
      db.providerSpecificationChangeNotification.findMany({
        where: {
          id: { in: ids },
          OR: [{ tenantOid: scope.tenant.oid }, { tenantOid: null }]
        },
        select: { oid: true }
      })
  });
