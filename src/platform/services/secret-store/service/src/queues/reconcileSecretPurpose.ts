import {
  combineQueueProcessors,
  createQueue,
  hourlyPacedDelay,
  QueueRetryError
} from '@lowerdeck/queue';
import { db } from '../db';
import { env } from '../env';
import { secretPurposeService } from '../services/secretPurpose';

export let reconcileSecretPurpose = async (secretOid: bigint) => {
  let secret = await db.secret.findUnique({
    where: { oid: secretOid }
  });
  if (!secret) throw new QueueRetryError();
  if (secret.purposeOid != null) return;

  if (!secret.purposeLegacy) {
    console.warn('[nebula] Secret is missing purposeLegacy during purpose reconciliation', {
      secretId: secret.id,
      secretOid: secret.oid.toString()
    });
    return;
  }

  let purpose = await secretPurposeService.ensurePurpose(secret.purposeLegacy);

  await db.secret.update({
    where: { oid: secret.oid },
    data: { purposeOid: purpose.oid }
  });
};

let RECONCILE_SECRET_PURPOSE_BATCH_SIZE = 500;

let reconcileSecretPurposeSearchQueue = createQueue<{ cursor?: bigint }>({
  name: 'neb/sec/purpose/reconcile/search',
  redisUrl: env.service.REDIS_URL
});

let reconcileSecretPurposeSearchQueueProcessor = reconcileSecretPurposeSearchQueue.process(
  async data => {
    let secrets = await db.secret.findMany({
      where: {
        purposeOid: null,
        purposeLegacy: { not: null },
        oid: data.cursor ? { lt: data.cursor } : undefined
      },
      orderBy: { oid: 'desc' },
      take: RECONCILE_SECRET_PURPOSE_BATCH_SIZE,
      select: { oid: true }
    });
    if (!secrets.length) return;

    await reconcileSecretPurposeSingleQueue.addMany(
      secrets.map(secret => ({
        secretOid: secret.oid
      }))
    );

    if (secrets.length === RECONCILE_SECRET_PURPOSE_BATCH_SIZE) {
      await reconcileSecretPurposeSearchQueue.add(
        { cursor: secrets[secrets.length - 1]!.oid },
        hourlyPacedDelay()
      );
    }
  }
);

let reconcileSecretPurposeSingleQueue = createQueue<{ secretOid: bigint }>({
  name: 'neb/sec/purpose/reconcile/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  }
});

let reconcileSecretPurposeSingleQueueProcessor = reconcileSecretPurposeSingleQueue.process(
  async data => {
    await reconcileSecretPurpose(data.secretOid);
  }
);

export let reconcileSecretPurposeProcessors = combineQueueProcessors([
  reconcileSecretPurposeSearchQueueProcessor,
  reconcileSecretPurposeSingleQueueProcessor
]);

export let startSecretPurposeReconciliation = async () => {
  await secretPurposeService.warmKnownPurposes();
  await reconcileSecretPurposeSearchQueue.add({});
};
