import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { slugify } from '@lowerdeck/slugify';
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
  projectOid: bigint | null;
  environmentOid: bigint;
  instanceOid: bigint | null;
  solutionOid: number;
};

let DEFAULT_ERROR_MESSAGES: Record<string, string> = {
  oauth_setup_failed: 'The OAuth setup flow could not be completed.'
};

let pickErrorSource = (value: unknown) => {
  if (
    value &&
    typeof value === 'object' &&
    'code' in value &&
    typeof (value as any).code === 'string'
  ) {
    let v = value as { code: string; message?: unknown };
    return {
      code: v.code,
      message: typeof v.message === 'string' && v.message.length ? v.message : null
    };
  }
  return null;
};

let getErrorInfo = (event: SlateOAuthSetupEventItem) => {
  let fromEvent = pickErrorSource(event.error);
  if (fromEvent) {
    if (fromEvent.code.startsWith('upstream.') && fromEvent.message) {
      fromEvent.code = slugify(fromEvent.message.replaceAll('_', '-')).replaceAll('-', '_');
    }

    return {
      code: fromEvent.code,
      message: fromEvent.message ?? DEFAULT_ERROR_MESSAGES[fromEvent.code] ?? fromEvent.code
    };
  }

  let fromInvocation = pickErrorSource(event.invocation?.error);
  if (fromInvocation) {
    if (fromInvocation.code.startsWith('upstream.') && fromInvocation.message) {
      fromInvocation.code = slugify(fromInvocation.message.replaceAll('_', '-')).replaceAll(
        '-',
        '_'
      );
    }

    return {
      code: fromInvocation.code,
      message:
        fromInvocation.message ??
        DEFAULT_ERROR_MESSAGES[fromInvocation.code] ??
        fromInvocation.code
    };
  }

  let code = event.type;
  return {
    code,
    message: DEFAULT_ERROR_MESSAGES[code] ?? 'An unknown error occurred during OAuth setup.'
  };
};

let getProviderInvocationId = (slateInvocationId: string | null | undefined) =>
  slateInvocationId ? createProviderInvocationId('slate.invocation', slateInvocationId) : null;

let getEventStatus = (event: SlateOAuthSetupEventItem): 'succeeded' | 'failed' => {
  if (event.type.endsWith('_failed')) return 'failed';

  let invocationStatus = event.invocation?.status;
  if (invocationStatus === 'invocation_failed' || invocationStatus === 'message_failed') {
    return 'failed';
  }

  return 'succeeded';
};

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
        status: getEventStatus(d.event),
        sourceType: 'slates.oauth_setup_event',
        sourceId: d.event.id,
        providerInvocationId: getProviderInvocationId(d.event.invocation?.id),
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

  let { code, message } = getErrorInfo(d.event);

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
  lock.usingLock(slatesBackend.id, async () => {
    let backend = await db.backend.findFirst({
      where: { id: slatesBackend.id },
      include: { slatesSyncOAuthSetupEventCursor: true }
    });
    if (!backend) throw new QueueRetryError();

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

  if (data.event.type !== 'oauth_setup_failed') return;

  await createErrorForEvent({
    event: data.event,
    providerOAuthSetup: refreshedSetup,
    providerAuthConfigEventOid: providerAuthConfigEvent.oid
  });
});
