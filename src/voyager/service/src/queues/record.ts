import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { defaultBackend } from '../backends';
import { db } from '../db';
import { env } from '../env';

export let indexRecordQueue = createQueue<{ recordId: string }>({
  name: 'voy/idx',
  redisUrl: env.service.REDIS_URL
});

export let indexRecordQueueProcessor = indexRecordQueue.process(async data => {
  let record = await db.record.findUnique({
    where: { id: data.recordId },
    include: { index: true }
  });
  if (!record) throw new QueueRetryError();

  await defaultBackend.indexRecords(record.index, [record]);
});

export let deleteRecordQueue = createQueue<{ recordId: string }>({
  name: 'voy/del',
  redisUrl: env.service.REDIS_URL
});

export let deleteRecordQueueProcessor = deleteRecordQueue.process(async data => {
  let record = await db.record.findUnique({
    where: { id: data.recordId },
    include: { index: true }
  });
  if (!record) throw new QueueRetryError();

  await defaultBackend.deleteRecordsById(record.index, [record.id]);
});
