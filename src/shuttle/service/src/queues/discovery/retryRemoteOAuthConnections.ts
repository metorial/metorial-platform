import { createCron } from '@lowerdeck/cron';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import {
  getRegistrationRetryCutoff,
  MAX_REGISTRATION_ATTEMPTS
} from '../../lib/oauth/registrationRetry';
import { remoteOAuthRegistrationService } from '../../services/oauth/remote/registration';

let RETRY_BATCH_SIZE = 250;

export let retryFailedRegistrationsCron = createCron(
  {
    name: 'shut/rem-oaconn/retry/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 3 * * *'
  },
  async () => {
    await retryFailedRegistrationsSearchQueue.add({});
  }
);

export let retryFailedRegistrationsSearchQueue = createQueue<{
  cursor?: string;
  serverId?: string;
}>({
  name: 'shut/rem-oaconn/retry/search',
  redisUrl: env.service.REDIS_URL
});

export let retryFailedRegistrationsSearchQueueProcessor =
  retryFailedRegistrationsSearchQueue.process(async data => {
    let retryCutoff = getRegistrationRetryCutoff();

    let connections = await db.remoteOAuthConnection.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        server: data.serverId ? { id: data.serverId } : undefined,

        status: 'active',
        discoveryStatus: 'failed',

        // Connections with their own client must never be re-registered, doing
        // so would swap the client out from under any token issued to it.
        registrationOid: null,
        secretOid: null,

        registrationAttemptCount: { lt: MAX_REGISTRATION_ATTEMPTS },
        OR: [
          { lastRegistrationAttemptAt: null },
          { lastRegistrationAttemptAt: { lt: retryCutoff } }
        ],

        config: { discoverStatus: 'supports_auto_registration' }
      },
      orderBy: { id: 'asc' },
      take: RETRY_BATCH_SIZE,
      select: { id: true }
    });
    if (connections.length === 0) return;

    await retryRegistrationQueue.addManyWithOps(
      connections.map(connection => ({
        data: { oauthConnectionId: connection.id },
        opts: { id: `rereg-${connection.id}` }
      }))
    );

    if (connections.length < RETRY_BATCH_SIZE) return;

    await retryFailedRegistrationsSearchQueue.add({
      cursor: connections[connections.length - 1]?.id,
      serverId: data.serverId
    });
  });

export let retryRegistrationQueue = createQueue<{ oauthConnectionId: string }>({
  name: 'shut/rem-oaconn/retry/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let retryRegistrationQueueProcessor = retryRegistrationQueue.process(async data => {
  let res = await remoteOAuthRegistrationService.runAutoRegistration({
    connectionId: data.oauthConnectionId
  });

  if (res.ok) return;

  // A connection that is gone or no longer eligible is not an error, the next
  // cron run reconsiders it.
  if (res.reason == 'failed' && res.isTransient) throw new QueueRetryError();
});
