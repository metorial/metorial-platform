import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveSessionTemplates = createResolver(async ({ ts, ids }) =>
  db.sessionTemplate.findMany({
    where: { ...ts, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveSessionTemplateProviders = createResolver(async ({ ts, ids }) =>
  db.sessionTemplateProvider.findMany({
    where: { ...ts, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveSessions = createResolver(async ({ ts, ids }) =>
  db.session.findMany({
    where: { ...ts, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveSessionProviders = createResolver(async ({ ts, ids }) =>
  db.sessionProvider.findMany({
    where: { ...ts, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveSessionEvents = createResolver(async ({ ts, ids, onlyLogsAfter }) =>
  db.sessionEvent.findMany({
    where: { ...ts, id: { in: ids }, createdAt: { gt: onlyLogsAfter } },
    select: { oid: true }
  })
);

export let resolveSessionMessages = createResolver(async ({ ts, ids, onlyLogsAfter }) =>
  db.sessionMessage.findMany({
    where: { ...ts, id: { in: ids }, createdAt: { gt: onlyLogsAfter } },
    select: { oid: true }
  })
);

export let resolveSessionConnections = createResolver(async ({ ts, ids, onlyLogsAfter }) =>
  db.sessionConnection.findMany({
    where: { ...ts, id: { in: ids }, createdAt: { gt: onlyLogsAfter } },
    select: { oid: true }
  })
);

export let resolveSessionErrors = createResolver(async ({ ts, ids, onlyLogsAfter }) =>
  db.sessionError.findMany({
    where: { ...ts, id: { in: ids }, createdAt: { gt: onlyLogsAfter } },
    select: { oid: true }
  })
);

export let resolveSessionErrorGroups = createResolver(async ({ ts, ids }) =>
  db.sessionErrorGroup.findMany({
    where: { tenantOid: ts.tenantOid, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveSessionParticipants = createResolver(async ({ ts, ids }) =>
  db.sessionParticipant.findMany({
    where: { tenantOid: ts.tenantOid, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveProviderRuns = createResolver(async ({ ts, ids, onlyLogsAfter }) =>
  db.providerRun.findMany({
    where: { ...ts, id: { in: ids }, createdAt: { gt: onlyLogsAfter } },
    select: { oid: true }
  })
);
