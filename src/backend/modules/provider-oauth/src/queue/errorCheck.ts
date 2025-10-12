import { db, ID } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { startOfWeek, subDays } from 'date-fns';

let errorCheckQueue = createQueue<{ connectionId: string }>({
  name: 'oat/err-chk',
  workerOpts: { concurrency: 10, limiter: { max: 25, duration: 1000 } }
});

export let errorCheckQueueProcessor = errorCheckQueue.process(async data => {
  let connection = await db.providerOAuthConnection.findUnique({
    where: { id: data.connectionId }
  });
  if (!connection) throw new QueueRetryError();

  let timeframe = subDays(new Date(), 4);

  let totalRecentTokens = await db.providerOAuthConnectionAuthToken.count({
    where: {
      connectionOid: connection.oid,
      lastUsedAt: { gte: timeframe }
    }
  });

  let errorTokens = await db.providerOAuthConnectionAuthToken.count({
    where: {
      connectionOid: connection.oid,
      errorCount: { gt: 0 },
      lastUsedAt: { gte: timeframe }
    }
  });

  let tokenRatio = totalRecentTokens > 5 ? errorTokens / totalRecentTokens : 0;

  let totalRecentAuths = await db.providerOAuthConnectionAuthAttempt.count({
    where: {
      connectionOid: connection.oid,
      createdAt: { gte: timeframe }
    }
  });

  let errorAuths = await db.providerOAuthConnectionAuthAttempt.count({
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

    await db.providerOAuthConnectionEvent.upsert({
      where: {
        connectionOid_event_discriminator: {
          connectionOid: connection.oid,
          event: 'errors',
          discriminator: discriminator
        }
      },
      update: {
        metadata
      },
      create: {
        id: await ID.generateId('oauthConnectionEvent'),
        connectionOid: connection.oid,
        event: 'errors',
        metadata
      }
    });
  }
});

export let addErrorCheck = async (connectionId: string) => {
  await errorCheckQueue.add({ connectionId }, { id: connectionId, delay: 1000 * 60 * 30 });
};
