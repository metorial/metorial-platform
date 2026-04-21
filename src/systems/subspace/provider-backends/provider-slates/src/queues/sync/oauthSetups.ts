import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { providerOAuthSetupInternalService } from '@metorial-subspace/module-auth';
import { backend as slatesBackend } from '../../backend';
import { slates } from '../../client';
import { env } from '../../env';

type SlateOAuthSetupLogs = Awaited<ReturnType<typeof slates.slateOAuthSetup.getLogsSync>>;

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

export let syncOAuthSetupsQueue = createQueue<{ cursor?: string }>({
  name: 'sub/slt/oauthSetup/many',
  redisUrl: env.service.REDIS_URL
});

export let syncOAuthSetupQueue = createQueue<{ providerOAuthSetupId: string }>({
  name: 'sub/slt/oauthSetup/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let lock = createLock({
  name: 'sub/slt/oauthSetup/lock',
  redisUrl: env.service.REDIS_URL
});

let createErrorForEvent = async (d: {
  sourceType: string;
  sourceId: string;
  type: string;
  code: string;
  message: string;
  payload: unknown;
  providerInvocationId?: string | null;
  authConfigEventOid?: bigint | null;
  providerOAuthSetup: {
    oid: bigint;
    authConfigOid: bigint | null;
    authCredentialsOid: bigint;
    providerOid: bigint;
    tenantOid: bigint;
    environmentOid: bigint;
    solutionOid: number;
  };
}) => {
  let existingError = await db.authConfigError.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: d.sourceType,
        sourceId: d.sourceId
      }
    }
  });
  if (existingError) return;

  let error = await db.authConfigError.create({
    data: {
      ...getId('authConfigError'),
      type: d.type,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      isProcessing: true,
      code: d.code,
      message: d.message,
      payload: d.payload,
      providerInvocationId: d.providerInvocationId ?? null,
      authConfigEventOid: d.authConfigEventOid ?? null,
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

let syncRemoteEvents = async (d: {
  providerOAuthSetup: {
    oid: bigint;
    authConfigOid: bigint | null;
    authCredentialsOid: bigint;
    providerOid: bigint;
    tenantOid: bigint;
    environmentOid: bigint;
    solutionOid: number;
  };
  remoteSetup: SlateOAuthSetupLogs;
}) => {
  for (let event of d.remoteSetup.events) {
    let authConfigEvent = await db.authConfigEvent.findUnique({
      where: {
        sourceType_sourceId: {
          sourceType: 'slates.oauth_setup_event',
          sourceId: event.id
        }
      }
    });

    if (!authConfigEvent) {
      authConfigEvent = await db.authConfigEvent.create({
        data: {
          ...getId('authConfigEvent'),
          type: event.type,
          sourceType: 'slates.oauth_setup_event',
          sourceId: event.id,
          providerInvocationId: event.invocation?.id ?? null,
          payload: event,
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

    if (event.type !== 'oauth_setup_failed') continue;

    let errorInfo = getErrorInfo(
      event.invocation?.error,
      d.remoteSetup.error?.code ?? event.type
    );

    await createErrorForEvent({
      sourceType: 'slates.oauth_setup_event',
      sourceId: event.id,
      type: event.type,
      code: errorInfo.code,
      message: d.remoteSetup.error?.message ?? errorInfo.message,
      payload: event,
      providerInvocationId: event.invocation?.id ?? null,
      authConfigEventOid: authConfigEvent.oid,
      providerOAuthSetup: d.providerOAuthSetup
    });
  }

  let failedEvent = d.remoteSetup.events.find(event => event.type === 'oauth_setup_failed');
  if (!failedEvent && d.remoteSetup.status === 'failed' && d.remoteSetup.error) {
    let sourceId = `${d.remoteSetup.id}:failed`;

    let authConfigEvent = await db.authConfigEvent.findUnique({
      where: {
        sourceType_sourceId: {
          sourceType: 'slates.oauth_setup',
          sourceId
        }
      }
    });

    if (!authConfigEvent) {
      authConfigEvent = await db.authConfigEvent.create({
        data: {
          ...getId('authConfigEvent'),
          type: 'oauth_setup_failed',
          sourceType: 'slates.oauth_setup',
          sourceId,
          payload: d.remoteSetup,
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

    await createErrorForEvent({
      sourceType: 'slates.oauth_setup',
      sourceId,
      type: 'oauth_setup_failed',
      code: d.remoteSetup.error.code,
      message: d.remoteSetup.error.message ?? d.remoteSetup.error.code,
      payload: d.remoteSetup,
      authConfigEventOid: authConfigEvent.oid,
      providerOAuthSetup: d.providerOAuthSetup
    });
  }
};

export let syncOAuthSetupsQueueProcessor = syncOAuthSetupsQueue.process(async data =>
  lock.usingLock(slatesBackend.id, async () => {
    let setups = await db.providerOAuthSetup.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        status: { in: ['unused', 'opened'] },
        slateOAuthSetupOid: { not: null }
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
  if (!providerOAuthSetup.slateOAuthSetupOid) return;

  await providerOAuthSetupInternalService.handleOAuthSetupResponse({
    providerOAuthSetup,
    context: {
      ip: '0.0.0.0',
      ua: 'subspace-slates-sync'
    }
  });

  let slateOAuthSetup = await db.slateOAuthSetup.findUnique({
    where: { oid: providerOAuthSetup.slateOAuthSetupOid }
  });
  if (!slateOAuthSetup) throw new QueueRetryError();

  let remoteSetup = await slates.slateOAuthSetup.getLogsSync({
    slateOAuthSetupId: slateOAuthSetup.id
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

  await syncRemoteEvents({
    providerOAuthSetup: refreshedSetup,
    remoteSetup
  });
});
