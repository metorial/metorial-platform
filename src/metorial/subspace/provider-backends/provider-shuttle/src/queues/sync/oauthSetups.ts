import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { providerOAuthSetupInternalService } from '@metorial-subspace/module-auth';
import { createProviderInvocationId } from '@metorial-subspace/provider-utils';
import { backend as shuttleBackend } from '../../backend';
import { shuttle } from '../../client';
import { env } from '../../env';

type ShuttleOAuthSetupEvent = Awaited<
  ReturnType<typeof shuttle.serverOAuthSetupEvent.listSync>
>['items'][number];

type SyncedProviderOAuthSetup = {
  oid: bigint;
  authConfigOid: bigint | null;
  authCredentialsOid: bigint;
  providerOid: bigint;
  tenantOid: bigint;
  projectOid: bigint | null;
  environmentOid: bigint;
  instanceOid: bigint | null;
  solutionOid: number;
};

export let syncOAuthSetupsQueue = createQueue<{}>({
  name: 'sub/shut/oauthSetup/many',
  redisUrl: env.service.REDIS_URL
});

export let syncOAuthSetupQueue = createQueue<{ event: ShuttleOAuthSetupEvent }>({
  name: 'sub/shut/oauthSetup/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let lock = createLock({
  name: 'sub/shut/oauthSetup/lock',
  redisUrl: env.service.REDIS_URL
});

let getErrorInfo = (event: ShuttleOAuthSetupEvent) => {
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

let isErrorEvent = (event: ShuttleOAuthSetupEvent) =>
  event.type.endsWith('_failed') || event.type.includes('error');

let getProviderInvocationId = (functionInvocationId: string | null | undefined) =>
  functionInvocationId
    ? createProviderInvocationId('shuttle.function_invocation', functionInvocationId)
    : null;

let ensureProviderAuthConfigEvent = async (d: {
  event: ShuttleOAuthSetupEvent;
  providerOAuthSetup: SyncedProviderOAuthSetup;
}) => {
  let providerAuthConfigEvent = await db.providerAuthConfigEvent.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'shuttle.server_oauth_setup',
        sourceId: d.event.id
      }
    }
  });

  if (!providerAuthConfigEvent) {
    providerAuthConfigEvent = await db.providerAuthConfigEvent.create({
      data: {
        ...getId('providerAuthConfigEvent'),
        type: d.event.type,
        sourceType: 'shuttle.server_oauth_setup',
        sourceId: d.event.id,
        providerInvocationId: getProviderInvocationId(d.event.functionInvocationId),
        payload: d.event,
        authConfigOid: d.providerOAuthSetup.authConfigOid,
        authCredentialsOid: d.providerOAuthSetup.authCredentialsOid,
        oauthSetupOid: d.providerOAuthSetup.oid,
        providerOid: d.providerOAuthSetup.providerOid,
        tenantOid: d.providerOAuthSetup.tenantOid,
        projectOid: d.providerOAuthSetup.projectOid,
        environmentOid: d.providerOAuthSetup.environmentOid,
        instanceOid: d.providerOAuthSetup.instanceOid,
        solutionOid: d.providerOAuthSetup.solutionOid
      }
    });
  }

  return providerAuthConfigEvent;
};

let createErrorForEvent = async (d: {
  event: ShuttleOAuthSetupEvent;
  providerOAuthSetup: SyncedProviderOAuthSetup;
  providerAuthConfigEventOid: bigint;
}) => {
  let existingError = await db.providerAuthConfigError.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'shuttle.server_oauth_setup',
        sourceId: d.event.id
      }
    }
  });
  if (existingError) return;

  let { code, message } = getErrorInfo(d.event);

  let error = await db.providerAuthConfigError.create({
    data: {
      ...getId('providerAuthConfigError'),
      type: d.event.type,
      sourceType: 'shuttle.server_oauth_setup',
      sourceId: d.event.id,
      isProcessing: true,
      code,
      message,
      payload: d.event,
      providerInvocationId: getProviderInvocationId(d.event.functionInvocationId),
      authConfigEventOid: d.providerAuthConfigEventOid,
      authConfigOid: d.providerOAuthSetup.authConfigOid,
      authCredentialsOid: d.providerOAuthSetup.authCredentialsOid,
      oauthSetupOid: d.providerOAuthSetup.oid,
      providerOid: d.providerOAuthSetup.providerOid,
      tenantOid: d.providerOAuthSetup.tenantOid,
      projectOid: d.providerOAuthSetup.projectOid,
      environmentOid: d.providerOAuthSetup.environmentOid,
      instanceOid: d.providerOAuthSetup.instanceOid,
      solutionOid: d.providerOAuthSetup.solutionOid
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
    data: { isProcessing: false, groupOid: group.oid }
  });
};

let backfillSetupLinks = async (d: { providerOAuthSetup: SyncedProviderOAuthSetup }) => {
  if (!d.providerOAuthSetup.authConfigOid) return;

  await db.providerAuthConfigEvent.updateMany({
    where: {
      oauthSetupOid: d.providerOAuthSetup.oid,
      authConfigOid: null
    },
    data: {
      authConfigOid: d.providerOAuthSetup.authConfigOid
    }
  });

  await db.providerAuthConfigError.updateMany({
    where: {
      oauthSetupOid: d.providerOAuthSetup.oid,
      authConfigOid: null
    },
    data: {
      authConfigOid: d.providerOAuthSetup.authConfigOid
    }
  });
};

export let syncOAuthSetupsQueueProcessor = syncOAuthSetupsQueue.process(async () =>
  lock.usingLock(shuttleBackend.id, async () => {
    let backend = await db.backend.findFirst({
      where: { id: shuttleBackend.id },
      include: { shuttleSyncOAuthSetupEventCursor: true }
    });
    if (!backend) throw new QueueRetryError();

    let events = await shuttle.serverOAuthSetupEvent.listSync({
      limit: 100,
      after: backend.shuttleSyncOAuthSetupEventCursor?.cursor,
      order: 'asc'
    });
    if (!events.items.length) return;

    await syncOAuthSetupQueue.addManyWithOps(
      events.items.map(event => ({
        data: { event },
        opts: { id: event.id }
      }))
    );

    let lastItem = events.items[events.items.length - 1];
    if (!lastItem) return;

    await db.shuttleSyncOAuthSetupEventCursor.upsert({
      where: { backendOid: backend.oid },
      create: { backendOid: backend.oid, cursor: lastItem.id },
      update: { cursor: lastItem.id }
    });

    await syncOAuthSetupsQueue.add({});
  })
);

export let syncOAuthSetupQueueProcessor = syncOAuthSetupQueue.process(async data => {
  let shuttleOAuthSetup = await db.shuttleOAuthSetup.findUnique({
    where: { id: data.event.serverOAuthSetupId }
  });
  if (!shuttleOAuthSetup) throw new QueueRetryError();

  let providerOAuthSetup = await db.providerOAuthSetup.findFirst({
    where: { shuttleOAuthSetupOid: shuttleOAuthSetup.oid }
  });
  if (!providerOAuthSetup) throw new QueueRetryError();

  await providerOAuthSetupInternalService.handleOAuthSetupResponse({
    providerOAuthSetup,
    context: {
      ip: '0.0.0.0',
      ua: 'subspace-shuttle-sync'
    }
  });

  let refreshedSetup = await db.providerOAuthSetup.findUnique({
    where: { id: providerOAuthSetup.id },
    select: {
      oid: true,
      authConfigOid: true,
      authCredentialsOid: true,
      providerOid: true,
      tenantOid: true,
      projectOid: true,
      environmentOid: true,
      instanceOid: true,
      solutionOid: true
    }
  });
  if (!refreshedSetup) throw new QueueRetryError();

  await backfillSetupLinks({
    providerOAuthSetup: refreshedSetup
  });

  let providerAuthConfigEvent = await ensureProviderAuthConfigEvent({
    event: data.event,
    providerOAuthSetup: refreshedSetup
  });

  if (!isErrorEvent(data.event)) return;

  await createErrorForEvent({
    event: data.event,
    providerOAuthSetup: refreshedSetup,
    providerAuthConfigEventOid: providerAuthConfigEvent.oid
  });
});
