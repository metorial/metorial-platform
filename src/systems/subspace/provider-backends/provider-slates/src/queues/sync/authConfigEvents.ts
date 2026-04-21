import { canonicalize } from '@lowerdeck/canonicalize';
import { createLock } from '@lowerdeck/lock';
import { Hash } from '@lowerdeck/hash';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { backend as slatesBackend } from '../../backend';
import { slates } from '../../client';
import { env } from '../../env';

type SlateAuthConfigEventItem = Awaited<
  ReturnType<typeof slates.slateAuthConfigEvent.listSync>
>['items'][number];

let getErrorInfo = (value: unknown, fallback: string) => {
  if (
    value &&
    typeof value === 'object' &&
    'code' in value &&
    typeof value.code === 'string'
  ) {
    return {
      code: value.code,
      message:
        'message' in value && typeof value.message === 'string' ? value.message : value.code
    };
  }

  return {
    code: fallback,
    message: fallback
  };
};

export let syncAuthConfigEventsQueue = createQueue<{}>({
  name: 'sub/slt/authEvt/many',
  redisUrl: env.service.REDIS_URL
});

export let syncAuthConfigEventQueue = createQueue<{
  event: SlateAuthConfigEventItem;
}>({
  name: 'sub/slt/authEvt/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let lock = createLock({
  name: 'sub/slt/authEvt/lock',
  redisUrl: env.service.REDIS_URL
});

export let syncAuthConfigEventsQueueProcessor = syncAuthConfigEventsQueue.process(async () =>
  lock.usingLock(slatesBackend.id, async () => {
    let backend = await db.backend.findFirst({
      where: { id: slatesBackend.id },
      include: { slatesSyncAuthConfigEventCursor: true }
    });
    if (!backend) throw new QueueRetryError();

    let events = await slates.slateAuthConfigEvent.listSync({
      limit: 100,
      after: backend.slatesSyncAuthConfigEventCursor?.cursor,
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

    await db.slatesSyncAuthConfigEventCursor.upsert({
      where: { backendOid: backend.oid },
      create: { backendOid: backend.oid, cursor: lastItem.id },
      update: { cursor: lastItem.id }
    });

    await syncAuthConfigEventsQueue.add({});
  })
);

export let syncAuthConfigEventQueueProcessor = syncAuthConfigEventQueue.process(async data => {
  let slateAuthConfig = await db.slateAuthConfig.findUnique({
    where: { id: data.event.authConfigId }
  });
  if (!slateAuthConfig) throw new QueueRetryError();

  let authConfigVersion = await db.providerAuthConfigVersion.findUnique({
    where: { slateAuthConfigOid: slateAuthConfig.oid },
    include: { authConfig: true }
  });
  if (!authConfigVersion) throw new QueueRetryError();

  let authConfigEvent = await db.authConfigEvent.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'slates.auth_config_event',
        sourceId: data.event.id
      }
    }
  });

  if (!authConfigEvent) {
    authConfigEvent = await db.authConfigEvent.create({
      data: {
        ...getId('authConfigEvent'),
        type: data.event.type,
        sourceType: 'slates.auth_config_event',
        sourceId: data.event.id,
        providerInvocationId: data.event.invocation?.id ?? null,
        payload: data.event,
        authConfigOid: authConfigVersion.authConfigOid,
        authCredentialsOid:
          authConfigVersion.authCredentialsOid ?? authConfigVersion.authConfig.authCredentialsOid,
        providerOid: authConfigVersion.authConfig.providerOid,
        tenantOid: authConfigVersion.authConfig.tenantOid,
        environmentOid: authConfigVersion.authConfig.environmentOid,
        solutionOid: authConfigVersion.authConfig.solutionOid
      }
    });
  }

  if (data.event.type !== 'oauth_token_refresh_failed') return;

  let existingError = await db.authConfigError.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'slates.auth_config_event',
        sourceId: data.event.id
      }
    }
  });
  if (existingError) return;

  let { code, message } = getErrorInfo(data.event.invocation?.error, data.event.type);

  let error = await db.authConfigError.create({
    data: {
      ...getId('authConfigError'),
      type: data.event.type,
      sourceType: 'slates.auth_config_event',
      sourceId: data.event.id,
      isProcessing: true,
      code,
      message,
      payload: data.event,
      providerInvocationId: data.event.invocation?.id ?? null,
      authConfigEventOid: authConfigEvent.oid,
      authConfigOid: authConfigVersion.authConfigOid,
      authCredentialsOid:
        authConfigVersion.authCredentialsOid ?? authConfigVersion.authConfig.authCredentialsOid,
      providerOid: authConfigVersion.authConfig.providerOid,
      tenantOid: authConfigVersion.authConfig.tenantOid,
      environmentOid: authConfigVersion.authConfig.environmentOid,
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

  let group = await db.authConfigErrorGlobal.upsert({
    where: {
      type_hash_tenantOid: {
        type: error.type,
        hash,
        tenantOid: error.tenantOid
      }
    },
    create: {
      ...getId('authConfigErrorGlobal'),
      type: error.type,
      code: error.code,
      message: error.message,
      hash,
      providerOid: error.providerOid,
      tenantOid: error.tenantOid,
      environmentOid: error.environmentOid,
      firstOccurrenceOid: error.oid
    },
    update: {}
  });

  await db.authConfigErrorGlobal.updateMany({
    where: { oid: group.oid },
    data: { occurrenceCount: { increment: 1 } }
  });

  await db.authConfigError.update({
    where: { oid: error.oid },
    data: {
      isProcessing: false,
      groupOid: group.oid
    }
  });
});
