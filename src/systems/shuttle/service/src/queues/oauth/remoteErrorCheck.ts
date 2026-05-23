import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { startOfWeek, subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';

let remoteOAuthErrorCheckQueue = createQueue<{ remoteConnectionId: string }>({
  redisUrl: env.service.REDIS_URL,
  name: 'shut/oat/err-chk/rem',
  workerOpts: { concurrency: 10, limiter: { max: 25, duration: 1000 } }
});

export let remoteOAuthErrorCheckQueueProcessor = remoteOAuthErrorCheckQueue.process(
  async data => {
    let connection = await db.remoteOAuthConnection.findUnique({
      where: { id: data.remoteConnectionId }
    });
    if (!connection) throw new QueueRetryError();

    let timeframe = subDays(new Date(), 4);

    let totalRecentTokens = await db.remoteOAuthConnectionAuthToken.count({
      where: {
        connectionOid: connection.oid,
        lastUsedAt: { gte: timeframe }
      }
    });

    let errorTokens = await db.remoteOAuthConnectionAuthToken.count({
      where: {
        connectionOid: connection.oid,
        errorCount: { gt: 0 },
        lastUsedAt: { gte: timeframe }
      }
    });

    let tokenRatio = totalRecentTokens > 5 ? errorTokens / totalRecentTokens : 0;

    let totalRecentAuths = await db.remoteOAuthConnectionSetup.count({
      where: {
        connectionOid: connection.oid,
        createdAt: { gte: timeframe }
      }
    });

    let errorAuths = await db.remoteOAuthConnectionSetup.count({
      where: {
        connectionOid: connection.oid,
        status: 'failed',
        createdAt: { gte: timeframe }
      }
    });

    let authRatio = totalRecentAuths > 5 ? errorAuths / totalRecentAuths : 0;

    if (tokenRatio > 0.15 || authRatio > 0.15) {
      let discriminator = startOfWeek(new Date()).getTime().toString(36);

      let metadata = {
        tokens: {
          total: totalRecentTokens,
          errors: errorTokens,
          ratio: tokenRatio
        },

        auths: {
          total: totalRecentAuths,
          errors: errorAuths,
          ratio: authRatio
        }
      };

      await db.remoteOAuthConnectionEvent.upsert({
        where: {
          connectionOid_type_discriminator: {
            connectionOid: connection.oid,
            type: 'errors',
            discriminator: discriminator
          }
        },
        update: {
          metadata
        },
        create: {
          ...getId('remoteOAuthConnectionEvent'),
          connectionOid: connection.oid,
          type: 'errors',
          metadata
        }
      });
    }
  }
);

export let addRemoteErrorCheck = async (connectionId: string) => {
  await remoteOAuthErrorCheckQueue.add(
    { remoteConnectionId: connectionId },
    { id: connectionId, delay: 1000 * 60 * 30 }
  );
};
