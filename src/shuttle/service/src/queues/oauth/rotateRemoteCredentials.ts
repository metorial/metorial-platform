import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { subHours } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import {
  getStaleRegistrationCutoff,
  isStaleRegistration
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
          // Only clients Metorial registered itself may be replaced.
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
        // Everything is re-read inside the lock, a concurrent rotation or a
        // manual credential change may have happened since the job was queued.
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

        let pendingReplacement = await db.remoteOAuthConnection.findFirst({
          where: {
            oid: { not: connection.oid },
            serverOid: credentials.serverOid,
            tenantOid: credentials.tenantOid,
            status: 'active',
            secretOid: null,
            discoveryStatus: { in: ['discovering', 'succeeded'] },
            createdAt: { gt: subHours(new Date(), 1) },
            serverOAuthCredentials: { isDefault: false }
          },
          select: { oid: true }
        });
        if (pendingReplacement) return;

        let config = await db.remoteOAuthConfig.findUniqueOrThrow({
          where: { oid: credentials.server.remoteOauthConfigOid! }
        });
        if (config.discoverStatus != 'supports_auto_registration') return;

        let replacement = await remoteOAuthConnectionService.createConnection({
          tenant: credentials.tenant,
          input: {
            config,
            scopes: connection.scopes
          }
        });
        if (!replacement.serverOAuthCredentials) return;

        await promoteRotatedCredentialsQueue.add(
          {
            newCredentialsId: replacement.serverOAuthCredentials.id,
            previousCredentialsId: current.id
          },
          { delay: 5000, id: `prom-${replacement.serverOAuthCredentials.id}` }
        );
      }
    );
  }
);

export let promoteRotatedCredentialsQueue = createQueue<{
  newCredentialsId: string;
  previousCredentialsId: string;
}>({
  name: 'shut/rem-oaconn/rotate/promote',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let promoteRotatedCredentialsQueueProcessor = promoteRotatedCredentialsQueue.process(
  async data => {
    let newCredentials = await db.serverOAuthCredentials.findUnique({
      where: { id: data.newCredentialsId },
      include: { remoteConnection: true }
    });
    if (!newCredentials?.remoteConnection) return;

    let previousCredentials = await db.serverOAuthCredentials.findUnique({
      where: { id: data.previousCredentialsId },
      include: { remoteConnection: true }
    });

    let newConnection = newCredentials.remoteConnection;
    let previousConnection = previousCredentials?.remoteConnection;

    // Registration is still running, wait for it with the queue's backoff.
    if (newConnection.discoveryStatus == 'discovering') throw new QueueRetryError();

    if (newConnection.discoveryStatus == 'failed') {
      // Transient provider failures do not spend the retry budget, so a
      // replacement without a counted attempt is still being retried.
      if (newConnection.registrationAttemptCount == 0) throw new QueueRetryError();

      // The previous credentials keep working, so a failed rotation is not an
      // error. The replacement is retired so nothing can pick it up later.
      await db.remoteOAuthConnection.updateMany({
        where: { oid: newConnection.oid, status: 'active' },
        data: { status: 'inactive' }
      });

      if (previousConnection) {
        await recordRotationEvent({
          connectionOid: previousConnection.oid,
          discriminator: newConnection.id,
          metadata: {
            status: 'failed',
            replacementConnectionId: newConnection.id,
            errorCode: newConnection.errorCode,
            errorMessage: newConnection.errorMessage
          }
        });
      }

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

    // Existing auth configs stay bound to the previous connection and keep
    // refreshing with the client they were authorized against.
    await recordRotationEvent({
      connectionOid: newConnection.oid,
      discriminator: previousConnection?.id ?? newConnection.id,
      metadata: {
        status: 'succeeded',
        role: 'replacement',
        previousConnectionId: previousConnection?.id ?? null,
        clientId: newConnection.clientId
      }
    });

    if (previousConnection) {
      await recordRotationEvent({
        connectionOid: previousConnection.oid,
        discriminator: newConnection.id,
        metadata: {
          status: 'succeeded',
          role: 'replaced',
          replacementConnectionId: newConnection.id
        }
      });
    }
  }
);

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
