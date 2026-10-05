import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { db } from '../db';
import { env } from '../env';
import { sendEmailQueue } from './sendEmail';

let BATCH_SIZE = 500;
let recoveryMany = createQueue<{ cursor?: string }>({
  name: 'fed/email/recovery/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});
let recoverySingle = createQueue<{ emailId: string }>({
  name: 'fed/email/recovery/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});
let recoveryManyProcessor = recoveryMany.process(async data => {
  let rows = await db.outgoingEmail.findMany({
    where: {
      queuedAt: null,
      createdAt: { lt: new Date(Date.now() - 60_000) },
      oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
    },
    orderBy: { oid: 'asc' },
    take: BATCH_SIZE,
    select: { oid: true, id: true }
  });
  await recoverySingle.addManyWithOps(
    rows.map(row => ({ data: { emailId: row.id }, opts: { id: row.id } }))
  );
  if (rows.length === BATCH_SIZE)
    await recoveryMany.add(
      { cursor: rows[rows.length - 1]!.oid.toString() },
      hourlyPacedDelay()
    );
});
let recoverySingleProcessor = recoverySingle.process(async ({ emailId }) => {
  let email = await db.outgoingEmail.findUnique({ where: { id: emailId } });
  if (!email || email.queuedAt) return;
  await sendEmailQueue.add({ emailId }, { id: emailId });
  await db.outgoingEmail.update({ where: { oid: email.oid }, data: { queuedAt: new Date() } });
});
let recoveryCron = createCron(
  { name: 'fed/email/recovery/cron', redisUrl: env.service.REDIS_URL, cron: '*/15 * * * *' },
  async () => {
    await recoveryMany.add({}, { id: 'scan' });
  }
);

export let recoverEmailProcessors = combineQueueProcessors([
  recoveryManyProcessor,
  recoverySingleProcessor,
  recoveryCron
]);
