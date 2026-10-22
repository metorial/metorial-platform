import { db, ID } from '@metorial/db';
import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  resolveSystemEventPayload,
  systemEventIngestQueue,
  type SystemEventIngestJob
} from '../src';
import { randomBigInt } from '../src/lib/oid';
import { waitForQueueJob } from './_fixtures';

let MAX_INT8 = 2n ** 63n - 1n;

describe('module-event-tracker ingest', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let buildJob = async (
    input: Partial<SystemEventIngestJob> & Pick<SystemEventIngestJob, 'payload'>
  ): Promise<SystemEventIngestJob> => ({
    id: await ID.generateId('systemEvent'),
    source: 'resource',
    eventType: 'organization.created',
    organizationId: org.ids.organizationId,
    instanceId: null,
    ...input
  });

  let ingest = async (job: SystemEventIngestJob, jobId = uniqueId('e2e-ingest')) => {
    await systemEventIngestQueue.add(job, { id: jobId });
    await waitForQueueJob(systemEventIngestQueue.name, jobId, 90_000);
  };

  it('stores organization-level events with a presented payload that exposes no internal ids', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let job = await buildJob({ payload: { organization: fixture.organization } });

    await ingest(job);

    let event = await db.systemEvent.findUniqueOrThrow({ where: { id: job.id } });
    expect(event).toMatchObject({
      source: 'resource',
      eventType: 'organization.created',
      organizationOid: fixture.organization.oid,
      instanceOid: null,
      payloadStorageKey: null
    });
    expect(event.oid).toBeGreaterThan(0n);
    expect(event.oid).toBeLessThanOrEqual(MAX_INT8);

    let payload = await resolveSystemEventPayload(event);
    expect(payload).toMatchObject({ object: 'organization', id: org.ids.organizationId });
    expect(JSON.stringify(payload)).not.toMatch(/"oid"/);
  }, 120_000);

  it('scopes events to the organization and instance named in the job', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let job = await buildJob({
      organizationId: otherOrg.ids.organizationId,
      instanceId: otherOrg.ids.instanceId,
      payload: { organization: otherFixture.organization }
    });

    await ingest(job);

    let event = await db.systemEvent.findUniqueOrThrow({ where: { id: job.id } });
    expect(event.organizationOid).toBe(otherFixture.organization.oid);
    expect(event.instanceOid).toBe(otherFixture.instance.oid);
    expect(
      await db.systemEvent.count({
        where: { id: job.id, organizationOid: fixture.organization.oid }
      })
    ).toBe(0);
  }, 120_000);

  it('ingests a re-delivered event only once', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let job = await buildJob({ payload: { organization: fixture.organization } });

    await ingest(job);
    let first = await db.systemEvent.findUniqueOrThrow({ where: { id: job.id } });

    await ingest(job);

    let events = await db.systemEvent.findMany({ where: { id: job.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.oid).toBe(first.oid);
    expect(events[0]!.createdAt).toEqual(first.createdAt);
  }, 180_000);

  it('drops events whose type has no webhook schema', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let job = await buildJob({
      eventType: 'e2e_unknown.created',
      payload: { organization: fixture.organization }
    });

    await ingest(job);

    expect(await db.systemEvent.findUnique({ where: { id: job.id } })).toBeNull();
  }, 120_000);

  it('ingests a concurrent burst of events promptly', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let jobs = await Promise.all(
      Array.from({ length: 16 }, () =>
        buildJob({ payload: { organization: fixture.organization } })
      )
    );

    for (let job of jobs) await systemEventIngestQueue.add(job, { id: job.id });

    let events = await eventually(
      async () => {
        let events = await db.systemEvent.findMany({
          where: { id: { in: jobs.map(job => job.id) } }
        });
        expect(events).toHaveLength(jobs.length);
        return events;
      },
      { timeoutMs: 15_000, intervalMs: 500 }
    );

    for (let event of events) {
      expect(event.oid).toBeGreaterThan(0n);
      expect(event.oid).toBeLessThanOrEqual(MAX_INT8);
    }
  }, 60_000);

  it('generates row oids that fit the signed 64-bit column', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    for (let i = 0; i < 2_000; i++) {
      let oid = randomBigInt();
      expect(oid >= 0n && oid <= MAX_INT8, `oid ${oid}`).toBe(true);
    }

    await expect(
      db.systemEvent.create({
        data: {
          oid: MAX_INT8 + 1n,
          id: await ID.generateId('systemEvent'),
          source: 'resource',
          eventType: 'organization.created',
          organizationOid: fixture.organization.oid
        }
      })
    ).rejects.toThrow();
  });
});
