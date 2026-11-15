import { Encryption } from '@lowerdeck/encryption';
import { parseRedisUrl } from '@lowerdeck/redis';
import { getConfig } from '@metorial/config';
import { AuditLogStreamStatus, db, ID } from '@metorial/db';
import { eventually, uniqueId } from '@metorial/e2e';
import type { OrganizationFixture } from '@metorial/e2e/db';
import { Queue } from 'bullmq';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect } from 'vitest';
import { env } from '../src/env';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

let encryption = new Encryption(env.secrets.ENCRYPTION_SECRET);

let redisConnection = () => parseRedisUrl(getConfig().redisUrl);

export let useRecordingServer = () => {
  let requests: RecordedRequest[] = [];
  let url = '';

  let server = createServer((request, response) => {
    let chunks: Buffer[] = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      requests.push({
        method: request.method ?? '',
        url: request.url ?? '',
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf-8')
      });

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ text: 'Success', code: 0 }));
    });
  });

  beforeAll(async () => {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    let { port } = server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}/services/collector/event`;
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  return {
    requests,
    get url() {
      return url;
    }
  };
};

/** Writes the stream row directly, so the stored provider data never passes destination validation. */
export let createUnvalidatedSplunkStream = async (
  fixture: OrganizationFixture,
  input: { endpoint: string; token: string; status?: AuditLogStreamStatus }
) => {
  let id = await ID.generateId('auditLogStream');

  return await db.auditLogStream.create({
    data: {
      id,
      provider: 'splunk',
      status: input.status ?? 'active',
      accessStatus: 'ok',
      organizationOid: fixture.organization.oid,
      providerDataRedacted: { endpoint: input.endpoint },
      encryptedProviderData: await encryption.encrypt({
        entityId: id,
        secret: JSON.stringify({ endpoint: input.endpoint, token: input.token })
      })
    }
  });
};

export let createAuditLogRow = async (fixture: OrganizationFixture) =>
  await db.auditLog.create({
    data: {
      id: await ID.generateId('auditLog'),
      resource: 'organization',
      action: 'update',
      ip: '127.0.0.1',
      ua: uniqueId('e2e-stream-sync'),
      organizationOid: fixture.organization.oid,
      organizationActorOid: fixture.actor.oid,
      actorType: 'org_actor',
      actorId: fixture.actor.id,
      recordedAt: new Date()
    }
  });

export let listStreamEvents = async (auditLogStreamOid: bigint) =>
  await db.auditLogStreamEvent.findMany({
    where: { auditLogStreamOid },
    orderBy: { oid: 'asc' }
  });

/** Runs a `@metorial/cron` handler now by queueing a job on the cron's BullMQ queue. */
export let triggerCron = async (name: string) => {
  let queue = new Queue(`Cr0N_mte/${name}`, { connection: redisConnection() });

  try {
    await queue.add('e2e', {});
  } finally {
    await queue.close();
  }
};

/** Completed jobs are removed (`removeOnComplete`), so an `unknown` state means the job finished. */
export let waitForQueueJob = async (queueName: string, jobId: string, timeoutMs = 60_000) => {
  let queue = new Queue(queueName, { connection: redisConnection() });

  try {
    await eventually(
      async () => expect(['completed', 'unknown']).toContain(await queue.getJobState(jobId)),
      { timeoutMs, intervalMs: 500 }
    );
  } finally {
    await queue.close();
  }
};
