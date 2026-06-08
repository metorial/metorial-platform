import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { subDays } from 'date-fns';
import { db } from '../db';
import { env } from '../env';

let disabledSecretRetentionDays = 14;

export let purgeDisabledSecret = async (secretOid: bigint) => {
  let secret = await db.secret.findUnique({
    where: { oid: secretOid }
  });
  if (!secret) throw new QueueRetryError();
  if (secret.status !== 'disabled') return;

  await db.secret.update({
    where: { oid: secret.oid },
    data: {
      status: 'deleted',
      deletedAt: new Date()
    }
  });
};

let purgeDisabledSecretsCron = createCron(
  {
    name: 'neb/sec/disabled/purge',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await purgeDisabledSecretsSearchQueue.add({
      before: subDays(new Date(), disabledSecretRetentionDays)
    });
  }
);

let purgeDisabledSecretsSearchQueue = createQueue<{ before: Date; cursor?: bigint }>({
  name: 'neb/sec/disabled/purge/search',
  redisUrl: env.service.REDIS_URL
});

let purgeDisabledSecretsSearchQueueProcessor = purgeDisabledSecretsSearchQueue.process(
  async data => {
    let secrets = await db.secret.findMany({
      where: {
        status: 'disabled',
        disabledAt: { lte: data.before },
        oid: data.cursor ? { lt: data.cursor } : undefined
      },
      orderBy: { oid: 'desc' },
      take: 500
    });
    if (!secrets.length) return;

    await purgeDisabledSecretSingleQueue.addMany(
      secrets.map(secret => ({
        secretOid: secret.oid
      }))
    );

    await purgeDisabledSecretsSearchQueue.add({
      before: data.before,
      cursor: secrets[secrets.length - 1]!.oid
    });
  }
);

let purgeDisabledSecretSingleQueue = createQueue<{ secretOid: bigint }>({
  name: 'neb/sec/disabled/purge/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

let purgeDisabledSecretSingleQueueProcessor = purgeDisabledSecretSingleQueue.process(async data => {
  await purgeDisabledSecret(data.secretOid);
});

export let purgeDisabledSecretsProcessors = combineQueueProcessors([
  purgeDisabledSecretsCron,
  purgeDisabledSecretsSearchQueueProcessor,
  purgeDisabledSecretSingleQueueProcessor
]);
