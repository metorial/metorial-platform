import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { createProviderInvocationId } from '@metorial-subspace/provider-utils';
import { backend as shuttleBackend } from '../../backend';
import { shuttle } from '../../client';
import { env } from '../../env';

type ShuttleAuthConfigEvent = Awaited<
  ReturnType<typeof shuttle.serverAuthConfigEvent.listSync>
>['items'][number];

let getErrorInfo = (event: ShuttleAuthConfigEvent) => {
  let payload =
    event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? event.payload
      : null;

  let code =
    payload &&
    'errorCode' in payload &&
    typeof payload.errorCode === 'string' &&
    payload.errorCode.length
      ? payload.errorCode
      : event.type;

  let message = event.message?.length ? event.message : code;

  return { code, message };
};

let isErrorEvent = (event: ShuttleAuthConfigEvent) =>
  event.type.endsWith('_failed') || event.type.includes('error');

let getProviderInvocationId = (functionInvocationId: string | null | undefined) =>
  functionInvocationId
    ? createProviderInvocationId('shuttle.function_invocation', functionInvocationId)
    : null;

export let syncAuthConfigEventsQueue = createQueue<{}>({
  name: 'sub/shut/authEvt/many',
  redisUrl: env.service.REDIS_URL
});

export let syncAuthConfigEventQueue = createQueue<{
  event: ShuttleAuthConfigEvent;
}>({
  name: 'sub/shut/authEvt/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let lock = createLock({
  name: 'sub/shut/authEvt/lock',
  redisUrl: env.service.REDIS_URL
});

export let syncAuthConfigEventsQueueProcessor = syncAuthConfigEventsQueue.process(async () =>
  lock.usingLock(shuttleBackend.id, async () => {
    let backend = await db.backend.findFirst({
      where: { id: shuttleBackend.id },
      include: { shuttleSyncAuthConfigEventCursor: true }
    });
    if (!backend) throw new QueueRetryError();

    let events = await shuttle.serverAuthConfigEvent.listSync({
      limit: 100,
      after: backend.shuttleSyncAuthConfigEventCursor?.cursor,
      order: 'asc'
    });
    if (!events.items.length) return;

    await syncAuthConfigEventQueue.addManyWithOps(
      events.items.map(event => ({
        data: { event },
        opts: { id: event.id }
      }))
    );

    let lastItem = events.items[events.items.length - 1];
    if (!lastItem) return;

    await db.shuttleSyncAuthConfigEventCursor.upsert({
      where: { backendOid: backend.oid },
      create: { backendOid: backend.oid, cursor: lastItem.id },
      update: { cursor: lastItem.id }
    });

    await syncAuthConfigEventsQueue.add({});
  })
);

export let syncAuthConfigEventQueueProcessor = syncAuthConfigEventQueue.process(async data => {
  let shuttleAuthConfig = await db.shuttleAuthConfig.findUnique({
    where: { id: data.event.serverAuthConfigId }
  });
  if (!shuttleAuthConfig) throw new QueueRetryError();

  let authConfigVersion = await db.providerAuthConfigVersion.findUnique({
    where: { shuttleAuthConfigOid: shuttleAuthConfig.oid },
    include: { authConfig: true }
  });
  if (!authConfigVersion) throw new QueueRetryError();

  let authConfigEvent = await db.providerAuthConfigEvent.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'shuttle.server_auth_config_event',
        sourceId: data.event.id
      }
    }
  });

  if (!authConfigEvent) {
    authConfigEvent = await db.providerAuthConfigEvent.create({
      data: {
        ...getId('providerAuthConfigEvent'),
        type: data.event.type,
        sourceType: 'shuttle.server_auth_config_event',
        sourceId: data.event.id,
        providerInvocationId: getProviderInvocationId(data.event.functionInvocationId),
        payload: data.event,
        authConfigOid: authConfigVersion.authConfigOid,
        authCredentialsOid:
          authConfigVersion.authCredentialsOid ??
          authConfigVersion.authConfig.authCredentialsOid,
        providerOid: authConfigVersion.authConfig.providerOid,
        tenantOid: authConfigVersion.authConfig.tenantOid,
        projectOid: authConfigVersion.authConfig.projectOid,
        environmentOid: authConfigVersion.authConfig.environmentOid,
        instanceOid: authConfigVersion.authConfig.instanceOid,
        solutionOid: authConfigVersion.authConfig.solutionOid
      }
    });
  }

  if (!isErrorEvent(data.event)) return;

  let existingError = await db.providerAuthConfigError.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'shuttle.server_auth_config_event',
        sourceId: data.event.id
      }
    }
  });
  if (existingError) return;

  let { code, message } = getErrorInfo(data.event);

  let error = await db.providerAuthConfigError.create({
    data: {
      ...getId('providerAuthConfigError'),
      type: data.event.type,
      sourceType: 'shuttle.server_auth_config_event',
      sourceId: data.event.id,
      isProcessing: true,
      code,
      message,
      payload: data.event,
      providerInvocationId: getProviderInvocationId(data.event.functionInvocationId),
      authConfigEventOid: authConfigEvent.oid,
      authConfigOid: authConfigVersion.authConfigOid,
      authCredentialsOid:
        authConfigVersion.authCredentialsOid ??
        authConfigVersion.authConfig.authCredentialsOid,
      providerOid: authConfigVersion.authConfig.providerOid,
      tenantOid: authConfigVersion.authConfig.tenantOid,
      projectOid: authConfigVersion.authConfig.projectOid,
      environmentOid: authConfigVersion.authConfig.environmentOid,
      instanceOid: authConfigVersion.authConfig.instanceOid,
      solutionOid: authConfigVersion.authConfig.solutionOid
    }
  });

  let hash = await Hash.sha256(
    canonicalize([
      error.type,
      String(error.providerOid),
      String(error.tenantOid),
      error.code,
      error.message
    ])
  );

  let group = await db.providerAuthConfigErrorGlobal.upsert({
    where: {
      type_hash_tenantOid: {
        type: error.type,
        hash,
        tenantOid: error.tenantOid
      }
    },
    create: {
      ...getId('providerAuthConfigErrorGlobal'),
      type: error.type,
      code: error.code,
      message: error.message,
      hash,
      providerOid: error.providerOid,
      tenantOid: error.tenantOid,
      projectOid: error.projectOid,
      environmentOid: error.environmentOid,
      instanceOid: error.instanceOid,
      firstOccurrenceOid: error.oid
    },
    update: {}
  });

  await db.providerAuthConfigErrorGlobal.updateMany({
    where: { oid: group.oid },
    data: { occurrenceCount: { increment: 1 } }
  });

  await db.providerAuthConfigError.update({
    where: { oid: error.oid },
    data: {
      isProcessing: false,
      groupOid: group.oid
    }
  });
});
