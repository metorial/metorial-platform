import { delay } from '@lowerdeck/delay';
import { parseRedisUrl } from '@lowerdeck/redis';
import { getConfig } from '@metorial/config';
import { db, ID, Prisma } from '@metorial/db';
import { uniqueId } from '@metorial/e2e';
import type { loadOrganizationFixture } from '@metorial/e2e/db';
import { Queue } from 'bullmq';
import { getEventPayloadsBucketName, getStorage } from '../src/storage';

type OrganizationFixture = Awaited<ReturnType<typeof loadOrganizationFixture>>;

let queues = new Map<string, Queue>();

let getBullQueue = (name: string) => {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: parseRedisUrl(getConfig().redisUrl) });
    queues.set(name, queue);
  }
  return queue;
};

export let waitForQueueJob = async (queueName: string, jobId: string, timeoutMs = 60_000) => {
  let queue = getBullQueue(queueName);
  let deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let state = await queue.getJobState(jobId.replaceAll(':', '_'));
    if (state == 'completed' || state == 'unknown') return;
    if (state == 'failed') throw new Error(`Job ${jobId} on ${queueName} failed`);
    await delay(500);
  }

  throw new Error(`Timed out waiting for job ${jobId} on ${queueName}`);
};

export let triggerCron = async (name: string) =>
  await getBullQueue(`Cr0N_mte/${name}`).add('e2e', {});

export let createSystemEventRow = async (
  fixture: OrganizationFixture,
  input: { payload?: Record<string, any> | null; ageMs?: number } = {}
) =>
  await db.systemEvent.create({
    data: {
      id: await ID.generateId('systemEvent'),
      source: 'resource',
      eventType: 'organization.created',
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      payloadJson:
        input.payload === null
          ? Prisma.DbNull
          : ((input.payload ?? { object: 'e2e', marker: uniqueId('e2e-payload') }) as any),
      createdAt: new Date(Date.now() - (input.ageMs ?? 0))
    }
  });

export let readStoredPayload = async (key: string) => {
  let object = await getStorage().getObject(getEventPayloadsBucketName(), key);
  return JSON.parse(object.data.toString('utf-8'));
};

export let storedPayloadExists = async (key: string) =>
  await getStorage()
    .headObject(getEventPayloadsBucketName(), key)
    .then(
      () => true,
      error => {
        if (error?.statusCode == 404) return false;
        throw error;
      }
    );
