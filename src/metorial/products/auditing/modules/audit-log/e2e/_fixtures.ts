import { parseRedisUrl } from '@lowerdeck/redis';
import { getConfig } from '@metorial/config';
import { eventually } from '@metorial/e2e';
import { Queue } from 'bullmq';
import { expect } from 'vitest';
import { auditLogService, type AuditLog } from '../src';

let MAX_PAGES = 200;

export let listAuditLogPage = async (
  organizationId: string,
  input: { limit: number; after?: string }
) => await (await auditLogService.listAuditLogs({ organizationId })).run(input);

export let listAllAuditLogs = async (organizationId: string, limit = 100) => {
  let items: AuditLog[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    let list = await listAuditLogPage(organizationId, { limit, after });
    items.push(...list.items);

    if (!list.pagination.hasNextPage || !list.items.length) return items;
    after = list.items.at(-1)!.id;
  }

  throw new Error(`More than ${MAX_PAGES} audit log pages for ${organizationId}`);
};

export let payloadId = (auditLog: AuditLog) =>
  (auditLog.payload as any)?.id as string | undefined;

/** Waits until the API process' audit listeners and the collector cron ingested an entry. */
export let waitForAuditLog = async (
  organizationId: string,
  match: (auditLog: AuditLog) => boolean,
  timeoutMs = 150_000
) =>
  await eventually(
    async () => {
      let auditLog = (await listAllAuditLogs(organizationId)).find(match);
      expect(auditLog).toBeDefined();
      return auditLog!;
    },
    { timeoutMs, intervalMs: 2_000 }
  );

/** Completed jobs are removed (`removeOnComplete`), so an `unknown` state means the job finished. */
export let waitForQueueJob = async (queueName: string, jobId: string, timeoutMs = 60_000) => {
  let queue = new Queue(queueName, { connection: parseRedisUrl(getConfig().redisUrl) });

  try {
    await eventually(
      async () => expect(['completed', 'unknown']).toContain(await queue.getJobState(jobId)),
      { timeoutMs, intervalMs: 500 }
    );
  } finally {
    await queue.close();
  }
};
