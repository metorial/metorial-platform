import { parseRedisUrl } from '@lowerdeck/redis';
import { serialize } from '@lowerdeck/serialize';
import { getAuditEventsByIds } from '@metorial/audit-models';
import { auditResources } from '@metorial/audit-schema';
import { createAuditScope, createSystemAuditScope } from '@metorial/audit-scope';
import { buildStashedAuditEvent } from '@metorial/audit-stash';
import { getConfig } from '@metorial/config';
import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { Queue } from 'bullmq';
import { describe, expect, it } from 'vitest';
import { auditTrackerService, processAuditEventQueue } from '../src';

let INGEST_TIMEOUT_MS = 150_000;

let scopeWith = (fixture: OrganizationFixture, ua: string) => ({
  ...fixture.auditScope,
  context: { ip: '127.0.0.1', ua }
});

let waitForRows = async (ua: string, count: number) =>
  await eventually(
    async () => {
      let rows = await db.auditLog.findMany({ where: { ua }, orderBy: { oid: 'asc' } });
      expect(rows).toHaveLength(count);
      return rows;
    },
    { timeoutMs: INGEST_TIMEOUT_MS, intervalMs: 2_000 }
  );

let waitForQueueJob = async (queueName: string, jobId: string) => {
  let queue = new Queue(queueName, { connection: parseRedisUrl(getConfig().redisUrl) });

  try {
    await eventually(
      async () => expect(['completed', 'unknown']).toContain(await queue.getJobState(jobId)),
      { timeoutMs: 60_000, intervalMs: 500 }
    );
  } finally {
    await queue.close();
  }
};

describe('module-audit-tracker recording', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('stores the presented payload and only the changed attributes of an update', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let ua = uniqueId('e2e-audit-diff');
    let project = { ...fixture.project, organization: fixture.organization };
    let renamed = uniqueId('Renamed project');

    await auditTrackerService.recordEvent(scopeWith(fixture, ua), 'project', 'update', {
      payload: { project: { ...project, name: renamed } },
      previousPayload: { project }
    });

    let [row] = await waitForRows(ua, 1);
    let [document] = await getAuditEventsByIds([row!.id]);

    expect(document).toMatchObject({
      resource: 'project',
      action: 'update',
      organizationOid: fixture.organization.oid.toString(),
      instanceOid: fixture.instance.oid.toString(),
      organizationActorOid: fixture.actor.oid.toString(),
      context: { ip: '127.0.0.1', ua }
    });
    expect(document!.payload).toMatchObject({ id: fixture.project.id, name: renamed });
    expect(JSON.stringify(document!.payload)).not.toMatch(/"(\w+_)?oid":/);
    expect(document!.previousAttributes).toEqual({ name: fixture.project.name });
  }, 180_000);

  it('stores the payload of a resource without a presenter as recorded', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let ua = uniqueId('e2e-audit-raw');
    let payload = {
      id: uniqueId('e2e-api-key'),
      status: 'active',
      type: 'instance_access_token_secret',
      name: uniqueId('key'),
      description: null,
      ipFilters: ['10.0.0.0/8'],
      expiresAt: null,
      deletedAt: null
    };

    await auditTrackerService.recordEvent(scopeWith(fixture, ua), 'api_key', 'create', {
      payload
    });

    let [row] = await waitForRows(ua, 1);
    let [document] = await getAuditEventsByIds([row!.id]);

    expect(document!.payload).toEqual(payload);
    expect(document!.previousAttributes).toBeUndefined();
  }, 180_000);

  it('keeps the actor type, actor metadata, context and recorded time of each scope', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let ua = uniqueId('e2e-audit-actors');
    let recordedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    let fineGrainedKeyId = uniqueId('e2e-fgk');
    let payload = { organization: fixture.organization };

    await auditTrackerService.recordEvents([
      {
        scope: createSystemAuditScope({
          organization: fixture.organization,
          instance: fixture.instance,
          job: 'e2e/audit/job',
          metadata: { attempt: 2 },
          context: { ip: '10.0.0.1', ua }
        }),
        resource: 'organization',
        action: 'update',
        payload,
        recordedAt
      },
      {
        scope: createAuditScope({
          organization: fixture.organization,
          instance: fixture.instance,
          actor: {
            type: 'fine_grained_token',
            id: fineGrainedKeyId,
            metadata: { sessionIds: ['ses_a', 'ses_b'] }
          },
          context: { ip: '10.0.0.2', ua }
        }),
        resource: 'organization',
        action: 'update',
        payload
      }
    ]);

    let rows = await waitForRows(ua, 2);
    let system = rows.find(row => row.actorType == 'system');
    let fineGrained = rows.find(row => row.actorType == 'fine_grained_token');

    expect(system).toMatchObject({
      actorId: 'e2e/audit/job',
      actorMetadata: { attempt: 2 },
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      organizationActorOid: null,
      ip: '10.0.0.1',
      recordedAt
    });
    expect(fineGrained).toMatchObject({
      actorId: fineGrainedKeyId,
      actorMetadata: { sessionIds: ['ses_a', 'ses_b'] },
      organizationActorOid: null,
      ip: '10.0.0.2'
    });
    expect(fineGrained!.recordedAt.getTime()).toBeGreaterThan(recordedAt.getTime());

    let documents = await getAuditEventsByIds([fineGrained!.id]);
    expect(documents[0]!.actor).toMatchObject({
      type: 'fine_grained_token',
      id: fineGrainedKeyId,
      metadata: { sessionIds: ['ses_a', 'ses_b'] }
    });
  }, 180_000);

  it('rejects unknown resources and actions, and whole batches containing one', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let ua = uniqueId('e2e-audit-invalid');
    let payload = { organization: fixture.organization };

    await expect(
      auditTrackerService.recordEvent(
        scopeWith(fixture, ua),
        'no_such_resource' as any,
        'create' as any,
        { payload } as any
      )
    ).rejects.toThrow('Unknown audit resource: no_such_resource');
    await expect(
      auditTrackerService.recordEvent(
        scopeWith(fixture, ua),
        'organization',
        'explode' as any,
        {
          payload
        } as any
      )
    ).rejects.toThrow('Unknown audit action: organization.explode');
    await expect(
      auditTrackerService.recordEvents([
        { scope: scopeWith(fixture, ua), resource: 'organization', action: 'update', payload },
        {
          scope: scopeWith(fixture, ua),
          resource: 'no_such_resource',
          action: 'create',
          payload
        }
      ])
    ).rejects.toThrow('Unknown audit resource');

    let sentinelUa = uniqueId('e2e-audit-sentinel');
    await auditTrackerService.recordEvent(
      scopeWith(fixture, sentinelUa),
      'organization',
      'update',
      {
        payload
      }
    );
    await waitForRows(sentinelUa, 1);

    expect(await db.auditLog.count({ where: { ua } })).toBe(0);
  }, 180_000);

  it('ingests a stashed event once, however often and in whichever job shape it is processed', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let stashed = await buildStashedAuditEvent(auditResources as any, {
      scope: scopeWith(fixture, uniqueId('e2e-audit-replay')),
      resource: 'organization',
      action: 'update',
      payload: { organization: fixture.organization }
    });
    let item = { event: stashed, encodedEvent: serialize.encode(stashed) };

    let batchJobId = uniqueId('e2e-audit-batch');
    await processAuditEventQueue.add({ events: [item, item] }, { id: batchJobId });
    await waitForQueueJob(processAuditEventQueue.name, batchJobId);

    let legacyJobId = uniqueId('e2e-audit-legacy');
    await processAuditEventQueue.add(item as any, { id: legacyJobId });
    await waitForQueueJob(processAuditEventQueue.name, legacyJobId);

    let rows = await db.auditLog.findMany({ where: { id: stashed.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organizationOid: fixture.organization.oid,
      resource: 'organization',
      action: 'update'
    });
    expect(await getAuditEventsByIds([stashed.id])).toHaveLength(1);
  }, 180_000);

  it('scopes every event of a mixed batch to its own organization', async () => {
    let [fixture, otherFixture] = await Promise.all([
      loadOrganizationFixture(org.ids),
      loadOrganizationFixture(otherOrg.ids)
    ]);
    let ua = uniqueId('e2e-audit-tenants');

    await auditTrackerService.recordEvents([
      {
        scope: scopeWith(fixture, ua),
        resource: 'organization',
        action: 'update',
        payload: { organization: fixture.organization }
      },
      {
        scope: scopeWith(otherFixture, ua),
        resource: 'organization',
        action: 'update',
        payload: { organization: otherFixture.organization }
      }
    ]);

    let rows = await waitForRows(ua, 2);
    expect(rows.map(row => [row.organizationOid, row.organizationActorOid]).sort()).toEqual(
      [
        [fixture.organization.oid, fixture.actor.oid],
        [otherFixture.organization.oid, otherFixture.actor.oid]
      ].sort()
    );

    let documents = await getAuditEventsByIds(rows.map(row => row.id));
    for (let row of rows) {
      let document = documents.find(item => item._id == row.id)!;
      expect(document.organizationOid).toBe(row.organizationOid.toString());
      expect((document.payload as any).id).toBe(
        row.organizationOid == fixture.organization.oid
          ? org.ids.organizationId
          : otherOrg.ids.organizationId
      );
    }
  }, 180_000);
});
