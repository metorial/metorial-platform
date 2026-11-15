import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { startOfWeek, subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';

let delegatedOAuthErrorCheckQueue = createQueue<{ delegatedConnectionId: string }>({
  redisUrl: env.service.REDIS_URL,
  name: 'shut/oat/err-chk/del',
  workerOpts: { concurrency: 10, limiter: { max: 25, duration: 1000 } }
});

export let delegatedOAuthErrorCheckQueueProcessor = delegatedOAuthErrorCheckQueue.process(
  async data => {
    let connection = await db.delegatedOAuthConnection.findUnique({
      where: { id: data.delegatedConnectionId }
    });
    if (!connection) throw new QueueRetryError();

    let timeframe = subDays(new Date(), 4);

    let totalRecentTokens = await db.delegatedOAuthConnectionAuthToken.count({
      where: {
        connectionOid: connection.oid,
        lastUsedAt: { gte: timeframe }
      }
    });

    let errorTokens = await db.delegatedOAuthConnectionAuthToken.count({
      where: {
        connectionOid: connection.oid,
        errorCount: { gt: 0 },
        lastUsedAt: { gte: timeframe }
      }
    });

    let tokenRatio = totalRecentTokens > 5 ? errorTokens / totalRecentTokens : 0;

    let totalRecentAuths = await db.delegatedOAuthConnectionSetup.count({
      where: {
        connectionOid: connection.oid,
        createdAt: { gte: timeframe }
      }
    });

    let errorAuths = await db.delegatedOAuthConnectionSetup.count({
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

      await db.delegatedOAuthConnectionEvent.upsert({
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
          ...getId('delegatedOAuthConnectionEvent'),
          connectionOid: connection.oid,
          type: 'errors',
          metadata
        }
      });
    }
  }
);

export let addDelegatedErrorCheck = async (connectionId: string) => {
  await delegatedOAuthErrorCheckQueue.add(
    { delegatedConnectionId: connectionId },
    { id: connectionId, delay: 1000 * 60 * 30 }
  );
};
