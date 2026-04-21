import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { providerOAuthSetupInternalService } from '@metorial-subspace/module-auth';
import { backend as shuttleBackend } from '../../backend';
import { shuttle } from '../../client';
import { env } from '../../env';

type ShuttleOAuthSetup = Awaited<ReturnType<typeof shuttle.serverOAuthSetup.getLogsSync>>;
type ShuttleOAuthSetupEvent = ShuttleOAuthSetup['events'][number];

export let syncOAuthSetupsQueue = createQueue<{ cursor?: string }>({
  name: 'sub/shut/oauthSetup/many',
  redisUrl: env.service.REDIS_URL
});

export let syncOAuthSetupQueue = createQueue<{ providerOAuthSetupId: string }>({
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

let createErrorForEvent = async (d: {
  event: ShuttleOAuthSetupEvent;
  setup: ShuttleOAuthSetup;
  providerOAuthSetup: {
    oid: bigint;
    authConfigOid: bigint | null;
    authCredentialsOid: bigint;
    providerOid: bigint;
    tenantOid: bigint;
    environmentOid: bigint;
    solutionOid: number;
  };
  authConfigEventOid: bigint;
}) => {
  let sourceId = d.event.id;

  let existingError = await db.authConfigError.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'shuttle.server_oauth_setup',
        sourceId
      }
    }
  });
  if (existingError) return;

  let { code, message } = getErrorInfo(d.event);

  let error = await db.authConfigError.create({
    data: {
      ...getId('authConfigError'),
      type: d.event.type,
      sourceType: 'shuttle.server_oauth_setup',
      sourceId,
      isProcessing: true,
      code,
      message,
      payload: {
        setup: d.setup,
        event: d.event
      },
      providerInvocationId: d.event.functionInvocationId ?? null,
      authConfigEventOid: d.authConfigEventOid,
      authConfigOid: d.providerOAuthSetup.authConfigOid,
      authCredentialsOid: d.providerOAuthSetup.authCredentialsOid,
      oauthSetupOid: d.providerOAuthSetup.oid,
      providerOid: d.providerOAuthSetup.providerOid,
      tenantOid: d.providerOAuthSetup.tenantOid,
      environmentOid: d.providerOAuthSetup.environmentOid,
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
    data: { isProcessing: false, groupOid: group.oid }
  });
};

let ensureAuthConfigEvent = async (d: {
  setup: ShuttleOAuthSetup;
  providerOAuthSetup: {
    oid: bigint;
    authConfigOid: bigint | null;
    authCredentialsOid: bigint;
    providerOid: bigint;
    tenantOid: bigint;
    environmentOid: bigint;
    solutionOid: number;
  };
  event: ShuttleOAuthSetupEvent;
}) => {
  let authConfigEvent = await db.authConfigEvent.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'shuttle.server_oauth_setup',
        sourceId: d.event.id
      }
    }
  });

  if (!authConfigEvent) {
    authConfigEvent = await db.authConfigEvent.create({
      data: {
        ...getId('authConfigEvent'),
        type: d.event.type,
        sourceType: 'shuttle.server_oauth_setup',
        sourceId: d.event.id,
        providerInvocationId: d.event.functionInvocationId ?? null,
        payload: {
          setup: d.setup,
          event: d.event
        },
        authConfigOid: d.providerOAuthSetup.authConfigOid,
        authCredentialsOid: d.providerOAuthSetup.authCredentialsOid,
        oauthSetupOid: d.providerOAuthSetup.oid,
        providerOid: d.providerOAuthSetup.providerOid,
        tenantOid: d.providerOAuthSetup.tenantOid,
        environmentOid: d.providerOAuthSetup.environmentOid,
        solutionOid: d.providerOAuthSetup.solutionOid
      }
    });
  }

  return authConfigEvent;
};

export let syncOAuthSetupsQueueProcessor = syncOAuthSetupsQueue.process(async data =>
  lock.usingLock(shuttleBackend.id, async () => {
    let setups = await db.providerOAuthSetup.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        status: { in: ['unused', 'opened'] },
        shuttleOAuthSetupOid: { not: null }
      },
      take: 100,
      orderBy: { id: 'asc' },
      select: { id: true }
    });
    if (setups.length === 0) return;

    await syncOAuthSetupQueue.addManyWithOps(
      setups.map(setup => ({
        data: { providerOAuthSetupId: setup.id },
        opts: { id: setup.id }
      }))
    );

    await syncOAuthSetupsQueue.add({
      cursor: setups[setups.length - 1]!.id
    });
  })
);

export let syncOAuthSetupQueueProcessor = syncOAuthSetupQueue.process(async data => {
  let providerOAuthSetup = await db.providerOAuthSetup.findUnique({
    where: { id: data.providerOAuthSetupId }
  });
  if (!providerOAuthSetup) throw new QueueRetryError();
  if (!providerOAuthSetup.shuttleOAuthSetupOid) return;

  await providerOAuthSetupInternalService.handleOAuthSetupResponse({
    providerOAuthSetup,
    context: {
      ip: '0.0.0.0',
      ua: 'subspace-shuttle-sync'
    }
  });

  let shuttleOAuthSetup = await db.shuttleOAuthSetup.findUnique({
    where: { oid: providerOAuthSetup.shuttleOAuthSetupOid }
  });
  if (!shuttleOAuthSetup) throw new QueueRetryError();

  let remoteSetup = await shuttle.serverOAuthSetup.getLogsSync({
    serverOAuthSetupId: shuttleOAuthSetup.id
  });

  let refreshedSetup = await db.providerOAuthSetup.findUnique({
    where: { id: data.providerOAuthSetupId },
    select: {
      oid: true,
      authConfigOid: true,
      authCredentialsOid: true,
      providerOid: true,
      tenantOid: true,
      environmentOid: true,
      solutionOid: true
    }
  });
  if (!refreshedSetup) throw new QueueRetryError();

  let events = remoteSetup.events.length
    ? remoteSetup.events
    : [
        {
          object: 'shuttle#server.oauth_setup.event',
          id: `${remoteSetup.id}:${remoteSetup.status}`,
          type:
            remoteSetup.status === 'completed'
              ? 'oauth_setup_completed'
              : 'oauth_setup_failed',
          message:
            remoteSetup.status === 'completed'
              ? 'OAuth setup completed'
              : 'OAuth setup failed',
          payload: null,
          functionInvocationId: null,
          serverConnectionId: null,
          createdAt: remoteSetup.updatedAt
        }
      ];

  for (let event of events) {
    let authConfigEvent = await ensureAuthConfigEvent({
      setup: remoteSetup,
      providerOAuthSetup: refreshedSetup,
      event
    });

    if (!isErrorEvent(event)) continue;

    await createErrorForEvent({
      event,
      setup: remoteSetup,
      providerOAuthSetup: refreshedSetup,
      authConfigEventOid: authConfigEvent.oid
    });
  }

  if (remoteSetup.status === 'pending') return;
});
