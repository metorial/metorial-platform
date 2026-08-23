import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db, type TransactionDB, withTransaction } from '../db';
import { env } from '../env';
import {
  type AresSsoUserSyncEventType,
  type AresSyncEvent,
  type AresSyncEventType,
  signAresSyncEventBody
} from '../lib/syncEvents';

type AresSyncEventSource =
  | { type: 'user.changed'; userId: string; revision: string }
  | { type: 'sso_tenant.changed'; tenantId: string; revision: string }
  | { type: AresSsoUserSyncEventType; ssoUserId: string; revision: string };

export let syncCallbackQueue = createQueue<AresSyncEventSource>({
  name: 'ares/sync/callback',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

let syncDeliveryQueue = createQueue<{ listenerId: string; event: AresSyncEvent }>({
  name: 'ares/sync/callback-delivery',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let resolveEvent = async (source: AresSyncEventSource): Promise<AresSyncEvent | null> => {
  if (source.type === 'user.changed') {
    let user = await db.user.findUnique({
      where: { id: source.userId },
      include: { app: true }
    });
    if (!user) return null;

    return {
      type: 'user.changed',
      data: { appId: user.app.id, userId: user.id, revision: source.revision }
    };
  }

  if (source.type === 'sso_tenant.changed') {
    let tenant = await db.ssoTenant.findUnique({
      where: { id: source.tenantId },
      include: { app: true }
    });
    if (!tenant) return null;

    return {
      type: 'sso_tenant.changed',
      data: { appId: tenant.app.id, tenantId: tenant.id, revision: source.revision }
    };
  }

  let ssoUser = await db.ssoUser.findUnique({
    where: { id: source.ssoUserId },
    include: { tenant: { include: { app: true } } }
  });
  if (!ssoUser) return null;

  return {
    type: source.type,
    data: {
      appId: ssoUser.tenant.app.id,
      tenantId: ssoUser.tenant.id,
      ssoUserId: ssoUser.id,
      revision: source.revision
    }
  };
};

let syncCallbackProcessor = syncCallbackQueue.process(async input => {
  let event = await resolveEvent(input);
  if (!event) return;

  let listeners = await db.syncListener.findMany({
    where: { eventTypes: { has: event.type satisfies AresSyncEventType } },
    select: { id: true }
  });

  await syncDeliveryQueue.addMany(
    listeners.map(listener => ({ listenerId: listener.id, event }))
  );
});

let syncDeliveryProcessor = syncDeliveryQueue.process(async input => {
  let listener = await db.syncListener.findUnique({ where: { id: input.listenerId } });
  if (!listener) return;

  let body = JSON.stringify(input.event);
  let response = await fetch(listener.callbackUrl, {
    method: 'POST',
    headers: {
      'ares-signature': signAresSyncEventBody({ secret: listener.secret, body }),
      'content-type': 'application/json'
    },
    body
  });

  if (!response.ok) {
    let responseBody = await response.text().catch(() => '');
    throw new Error(
      `Sync listener ${listener.identifier} returned ${response.status} for ${input.event.type}: ${responseBody.slice(0, 500)}`
    );
  }
});

export let markAresUserChanged = async (input: {
  userId?: string;
  userOid?: bigint;
  db?: TransactionDB;
}) => {
  let tdb = input.db ?? db;
  let user = await tdb.user.update({
    where: input.userId ? { id: input.userId } : { oid: input.userOid! },
    data: { syncRevision: { increment: 1 } },
    select: { id: true, syncRevision: true }
  });
  addAfterTransactionHook(() =>
    syncCallbackQueue.add(
      { type: 'user.changed', userId: user.id, revision: user.syncRevision.toString() },
      { id: `${user.id}-${user.syncRevision}` }
    )
  );
  return user;
};

export let markAresSsoTenantChanged = async (input: {
  tenantId?: string;
  tenantOid?: bigint;
}) =>
  await withTransaction(async tdb => {
    let tenant = await tdb.ssoTenant.update({
      where: input.tenantId ? { id: input.tenantId } : { oid: input.tenantOid! },
      data: { syncRevision: { increment: 1 } },
      select: { id: true, syncRevision: true }
    });
    addAfterTransactionHook(() =>
      syncCallbackQueue.add(
        {
          type: 'sso_tenant.changed',
          tenantId: tenant.id,
          revision: tenant.syncRevision.toString()
        },
        { id: `${tenant.id}-${tenant.syncRevision}` }
      )
    );
    return tenant;
  });

export let markAresSsoUserChanged = async (input: {
  ssoUserId?: string;
  ssoUserOid?: bigint;
  types: readonly AresSsoUserSyncEventType[];
}) => {
  if (input.types.length === 0) return null;

  return await withTransaction(async tdb => {
    let ssoUser = await tdb.ssoUser.update({
      where: input.ssoUserId ? { id: input.ssoUserId } : { oid: input.ssoUserOid! },
      data: { syncRevision: { increment: 1 } },
      select: { id: true, syncRevision: true }
    });
    addAfterTransactionHook(() =>
      syncCallbackQueue.addManyWithOps(
        input.types.map(type => ({
          data: {
            type,
            ssoUserId: ssoUser.id,
            revision: ssoUser.syncRevision.toString()
          },
          opts: { id: `${ssoUser.id}-${ssoUser.syncRevision}-${type}` }
        }))
      )
    );
    return ssoUser;
  });
};

export let markAresSsoTenantChangedForConnection = async (input: { connectionOid: bigint }) =>
  await withTransaction(async tdb => {
    let connection = await tdb.ssoConnection.findUnique({
      where: { oid: input.connectionOid },
      select: { tenantOid: true }
    });
    if (!connection) return null;

    return await markAresSsoTenantChanged({ tenantOid: connection.tenantOid });
  });

export let syncCallbackQueueProcessor = combineQueueProcessors([
  syncCallbackProcessor,
  syncDeliveryProcessor
]);
