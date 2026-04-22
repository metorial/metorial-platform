import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { providerOAuthSetupInternalService } from '@metorial-subspace/module-auth';
import { createProviderInvocationId } from '@metorial-subspace/provider-utils';
import { backend as slatesBackend } from '../../backend';
import { slates } from '../../client';
import { env } from '../../env';

type SlateOAuthSetupEventItem = Awaited<
  ReturnType<typeof slates.slateOAuthSetupEvent.listSync>
>['items'][number];

type SyncedProviderOAuthSetup = {
  oid: bigint;
  authConfigOid: bigint | null;
  authCredentialsOid: bigint;
  providerOid: bigint;
  tenantOid: bigint;
  environmentOid: bigint;
  solutionOid: number;
};

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

let getProviderInvocationId = (slateInvocationId: string | null | undefined) =>
  slateInvocationId ? createProviderInvocationId('slate.invocation', slateInvocationId) : null;

export let syncOAuthSetupsQueue = createQueue<{}>({
  name: 'sub/slt/oauthSetup/many',
  redisUrl: env.service.REDIS_URL
});

export let syncOAuthSetupQueue = createQueue<{
  event: SlateOAuthSetupEventItem;
}>({
  name: 'sub/slt/oauthSetup/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let lock = createLock({
  name: 'sub/slt/oauthSetup/lock',
  redisUrl: env.service.REDIS_URL
});

let ensureProviderAuthConfigEvent = async (d: {
  event: SlateOAuthSetupEventItem;
  providerOAuthSetup: SyncedProviderOAuthSetup;
}) => {
  let providerAuthConfigEvent = await db.providerAuthConfigEvent.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'slates.oauth_setup_event',
        sourceId: d.event.id
      }
    }
  });

  if (!providerAuthConfigEvent) {
    providerAuthConfigEvent = await db.providerAuthConfigEvent.create({
      data: {
        ...getId('providerAuthConfigEvent'),
        type: d.event.type,
        sourceType: 'slates.oauth_setup_event',
        sourceId: d.event.id,
        providerInvocationId: getProviderInvocationId(d.event.invocation?.id),
        payload: d.event,
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

  return providerAuthConfigEvent;
};

let createErrorForEvent = async (d: {
  event: SlateOAuthSetupEventItem;
  providerOAuthSetup: SyncedProviderOAuthSetup;
  providerAuthConfigEventOid: bigint;
}) => {
  let existingError = await db.providerAuthConfigError.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'slates.oauth_setup_event',
        sourceId: d.event.id
      }
    }
  });
  if (existingError) return;

  let { code, message } = getErrorInfo(d.event.invocation?.error, d.event.type);

  let error = await db.providerAuthConfigError.create({
    data: {
      ...getId('providerAuthConfigError'),
      type: d.event.type,
      sourceType: 'slates.oauth_setup_event',
      sourceId: d.event.id,
      isProcessing: true,
      code,
      message,
      payload: d.event,
      providerInvocationId: getProviderInvocationId(d.event.invocation?.id),
      authConfigEventOid: d.providerAuthConfigEventOid,
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
      environmentOid: error.environmentOid,
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
  lock.usingLock(slatesBackend.id, async () => {
    let backend = await db.backend.findFirst({
      where: { id: slatesBackend.id },
      include: { slatesSyncOAuthSetupEventCursor: true }
    });
    if (!backend) throw new QueueRetryError();

    console.log(backend.slatesSyncOAuthSetupEventCursor?.cursor);

    let events = await slates.slateOAuthSetupEvent.listSync({
      limit: 100,
      after: backend.slatesSyncOAuthSetupEventCursor?.cursor,
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

    await db.slatesSyncOAuthSetupEventCursor.upsert({
      where: { backendOid: backend.oid },
      create: { backendOid: backend.oid, cursor: lastItem.id },
      update: { cursor: lastItem.id }
    });

    await syncOAuthSetupsQueue.add({});
  })
);

export let syncOAuthSetupQueueProcessor = syncOAuthSetupQueue.process(async data => {
  let slateOAuthSetup = await db.slateOAuthSetup.findUnique({
    where: { id: data.event.slateOAuthSetupId }
  });
  if (!slateOAuthSetup) throw new QueueRetryError();

  let providerOAuthSetup = await db.providerOAuthSetup.findFirst({
    where: { slateOAuthSetupOid: slateOAuthSetup.oid }
  });
  if (!providerOAuthSetup) throw new QueueRetryError();

  await providerOAuthSetupInternalService.handleOAuthSetupResponse({
    providerOAuthSetup,
    context: {
      ip: '0.0.0.0',
      ua: 'subspace-slates-sync'
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
      environmentOid: true,
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

  if (data.event.type !== 'oauth_setup_failed') return;

  await createErrorForEvent({
    event: data.event,
    providerOAuthSetup: refreshedSetup,
    providerAuthConfigEventOid: providerAuthConfigEvent.oid
  });
});
