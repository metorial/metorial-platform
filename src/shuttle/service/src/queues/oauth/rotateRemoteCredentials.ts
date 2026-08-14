import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import {
  getStaleRegistrationCutoff,
  isStaleRegistration,
  MAX_REGISTRATION_ATTEMPTS
} from '../../lib/oauth/registrationRetry';
import { remoteOAuthConnectionService } from '../../services/oauth/remote/connection';
import { withTransaction } from '../../transaction';

let ROTATE_BATCH_SIZE = 100;

let rotationLock = createLock({
  name: 'shut/rem-oaconn/rotate/lock',
  redisUrl: env.service.REDIS_URL
});

export let rotateStaleCredentialsSearchQueue = createQueue<{
  serverId: string;
  cursor?: string;
}>({
  name: 'shut/rem-oaconn/rotate/search',
  redisUrl: env.service.REDIS_URL
});

export let rotateStaleCredentialsSearchQueueProcessor =
  rotateStaleCredentialsSearchQueue.process(async data => {
    let staleCutoff = getStaleRegistrationCutoff();

    let credentials = await db.serverOAuthCredentials.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,

        type: 'remote',
        isDefault: true,

        server: {
          id: data.serverId,
          remoteOauthConfig: { discoverStatus: 'supports_auto_registration' }
        },

        remoteConnection: {
          status: 'active',
          discoveryStatus: 'succeeded',

          secretOid: null,
          registrationOid: { not: null },
          registration: { createdAt: { lt: staleCutoff } }
        }
      },
      orderBy: { id: 'asc' },
      take: ROTATE_BATCH_SIZE,
      select: { id: true }
    });
    if (credentials.length === 0) return;

    await rotateStaleCredentialsQueue.addManyWithOps(
      credentials.map(credential => ({
        data: { credentialsId: credential.id },
        opts: { id: `rot-${credential.id}` }
      }))
    );

    if (credentials.length < ROTATE_BATCH_SIZE) return;

    await rotateStaleCredentialsSearchQueue.add({
      serverId: data.serverId,
      cursor: credentials[credentials.length - 1]?.id
    });
  });

export let rotateStaleCredentialsQueue = createQueue<{ credentialsId: string }>({
  name: 'shut/rem-oaconn/rotate/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 3, limiter: { max: 5, duration: 1000 } }
});

export let rotateStaleCredentialsQueueProcessor = rotateStaleCredentialsQueue.process(
  async data => {
    let credentials = await db.serverOAuthCredentials.findUnique({
      where: { id: data.credentialsId },
      include: {
        tenant: true,
        server: true,
        remoteConnection: { include: { registration: true } }
      }
    });
    if (!credentials) return;

    let previousConnection = credentials.remoteConnection;
    if (!previousConnection?.registration) return;
    if (!credentials.server.remoteOauthConfigOid) return;

    await rotationLock.usingLock(
      `${credentials.tenantOid}-${credentials.serverOid}`,
      async () => {
        let current = await db.serverOAuthCredentials.findUnique({
          where: { oid: credentials.oid },
          include: { remoteConnection: { include: { registration: true } } }
        });
        if (!current?.isDefault) return;

        let connection = current.remoteConnection;
        if (!connection?.registration) return;
        if (connection.status != 'active' || connection.discoveryStatus != 'succeeded') return;
        if (connection.secretOid != null) return;
        if (!isStaleRegistration(connection.registration)) return;

        let existingReplacement = await db.remoteOAuthConnection.findFirst({
          where: {
            rotatedFromOid: connection.oid,
            status: 'active'
          },
          include: { serverOAuthCredentials: true },
          orderBy: { oid: 'desc' }
        });

        if (existingReplacement) {
          if (existingReplacement.discoveryStatus != 'failed') {
            await enqueuePromotion({ connectionId: existingReplacement.id });
            return;
          }

          if (existingReplacement.registrationAttemptCount < MAX_REGISTRATION_ATTEMPTS) return;

          await retireReplacement({
            connection: existingReplacement,
            previousConnection: connection
          });
        }

        let config = await db.remoteOAuthConfig.findUniqueOrThrow({
          where: { oid: credentials.server.remoteOauthConfigOid! }
        });
        if (config.discoverStatus != 'supports_auto_registration') return;

        let replacement = await remoteOAuthConnectionService.createConnection({
          tenant: credentials.tenant,
          input: {
            config,
            scopes: connection.scopes,
            rotatedFromOid: connection.oid
          }
        });
        if (!replacement.serverOAuthCredentials) return;

        await enqueuePromotion({ connectionId: replacement.id });
      }
    );
  }
);

export let promoteRotatedCredentialsQueue = createQueue<{
  newCredentialsId: string;
}>({
  name: 'shut/rem-oaconn/rotate/promote',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let promoteRotatedCredentialsQueueProcessor = promoteRotatedCredentialsQueue.process(
  async data => {
    let newCredentials = await db.serverOAuthCredentials.findUnique({
      where: { id: data.newCredentialsId },
      include: { remoteConnection: { include: { rotatedFrom: true } } }
    });
    if (!newCredentials?.remoteConnection) return;
    if (newCredentials.isDefault) return;

    let newConnection = newCredentials.remoteConnection;
    let previousConnection = newConnection.rotatedFrom;

    if (!previousConnection) return;
    if (newConnection.status != 'active') return;

    if (newConnection.discoveryStatus == 'discovering') throw new QueueRetryError();

    if (newConnection.discoveryStatus == 'failed') {
      if (newConnection.registrationAttemptCount < MAX_REGISTRATION_ATTEMPTS) return;

      await retireReplacement({ connection: newConnection, previousConnection });

      return;
    }

    await rotationLock.usingLock(
      `${newCredentials.tenantOid}-${newCredentials.serverOid}`,
      () => promoteCredentials({ newCredentials, newConnection, previousConnection })
    );
  }
);

let promoteCredentials = async (d: {
  newCredentials: { oid: bigint; tenantOid: bigint; serverOid: bigint };
  newConnection: { oid: bigint; id: string; clientId: string | null };
  previousConnection: { oid: bigint; id: string };
}) => {
  let { newCredentials, newConnection, previousConnection } = d;

  let currentDefault = await db.serverOAuthCredentials.findFirst({
    where: {
      tenantOid: newCredentials.tenantOid,
      serverOid: newCredentials.serverOid,
      isDefault: true
    },
    select: { oid: true, remoteConnectionOid: true }
  });
  if (currentDefault?.oid == newCredentials.oid) return;

  if (currentDefault?.remoteConnectionOid != previousConnection.oid) {
    await retireReplacement({ connection: newConnection, previousConnection: null });

    return;
  }

  await withTransaction(async db => {
    await db.serverOAuthCredentials.updateMany({
      where: {
        tenantOid: newCredentials.tenantOid,
        serverOid: newCredentials.serverOid,
        isDefault: true,
        oid: { not: newCredentials.oid }
      },
      data: { isDefault: false }
    });

    await db.serverOAuthCredentials.update({
      where: { oid: newCredentials.oid },
      data: { isDefault: true }
    });
  });

  await recordRotationEvent({
    connectionOid: newConnection.oid,
    discriminator: previousConnection.id,
    metadata: {
      status: 'succeeded',
      role: 'replacement',
      previousConnectionId: previousConnection.id,
      clientId: newConnection.clientId
    }
  });

  await recordRotationEvent({
    connectionOid: previousConnection.oid,
    discriminator: newConnection.id,
    metadata: {
      status: 'succeeded',
      role: 'replaced',
      replacementConnectionId: newConnection.id
    }
  });
};

export let enqueuePromotion = async (d: { connectionId: string }) => {
  let credentials = await db.serverOAuthCredentials.findFirst({
    where: {
      isDefault: false,
      remoteConnection: {
        id: d.connectionId,
        status: 'active',
        rotatedFromOid: { not: null },
        discoveryStatus: { in: ['discovering', 'succeeded'] }
      }
    },
    select: { id: true }
  });
  if (!credentials) return;

  await promoteRotatedCredentialsQueue.add(
    { newCredentialsId: credentials.id },
    { delay: 5000 }
  );
};

let retireReplacement = async (d: {
  connection: {
    oid: bigint;
    id: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  };
  previousConnection: { oid: bigint } | null;
}) => {
  await db.remoteOAuthConnection.updateMany({
    where: { oid: d.connection.oid, status: 'active' },
    data: { status: 'inactive' }
  });

  if (!d.previousConnection) return;

  await recordRotationEvent({
    connectionOid: d.previousConnection.oid,
    discriminator: d.connection.id,
    metadata: {
      status: 'failed',
      replacementConnectionId: d.connection.id,
      errorCode: d.connection.errorCode ?? null,
      errorMessage: d.connection.errorMessage ?? null
    }
  });
};

let recordRotationEvent = async (d: {
  connectionOid: bigint;
  discriminator: string;
  metadata: Record<string, any>;
}) => {
  await db.remoteOAuthConnectionEvent.upsert({
    where: {
      connectionOid_type_discriminator: {
        connectionOid: d.connectionOid,
        type: 'credentials_rotated',
        discriminator: d.discriminator
      }
    },
    update: { metadata: d.metadata },
    create: {
      ...getId('remoteOAuthConnectionEvent'),
      connectionOid: d.connectionOid,
      type: 'credentials_rotated',
      discriminator: d.discriminator,
      metadata: d.metadata
    }
  });
};
