import { getAuditEventsByIds } from '@metorial/audit-models';
import { eventually, expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { describe, expect, it } from 'vitest';
import {
  auditLogRetentionService,
  cleanupAuditLogOrganizationsQueue,
  cleanupOrganizationAuditLogsQueue
} from '../src';
import { waitForQueueJob } from './_fixtures';

let DAY_MS = 24 * 60 * 60 * 1000;

let daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

let recordEntries = async (
  entries: { fixture: OrganizationFixture; recordedAt: Date }[],
  ua: string
) => {
  await auditTrackerService.recordEvents(
    entries.map(entry => ({
      scope: { ...entry.fixture.auditScope, context: { ip: '127.0.0.1', ua } },
      resource: 'organization',
      action: 'update',
      payload: { organization: entry.fixture.organization },
      recordedAt: entry.recordedAt
    }))
  );

  return await eventually(
    async () => {
      let rows = await db.auditLog.findMany({ where: { ua }, orderBy: { recordedAt: 'asc' } });
      expect(rows).toHaveLength(entries.length);
      return rows;
    },
    { timeoutMs: 150_000, intervalMs: 2_000 }
  );
};

let createLegacyEvent = async (fixture: OrganizationFixture, recordedAt: Date) =>
  await db.auditLogEvent.create({
    data: {
      id: uniqueId('e2e-legacy-event'),
      resource: 'organization',
      action: 'update',
      organizationOid: fixture.organization.oid,
      recordedAt
    }
  });

describe('module-audit-log retention', () => {
  let org = useOrganization();
  let unlimitedOrg = useOrganization();
  let longOrg = useOrganization();

  it('refuses to read or change the retention of a deleted organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let deleted = { ...fixture.organization, status: 'deleted' as const };

    await expectServiceError(
      auditLogRetentionService.getAuditLogRetention({ organization: deleted }),
      'forbidden'
    );
    await expectServiceError(
      auditLogRetentionService.updateAuditLogRetention({
        organization: deleted,
        auditScope: fixture.auditScope,
        input: { auditLogRetentionInDays: 1 }
      }),
      'forbidden'
    );

    let row = await db.organization.findUniqueOrThrow({
      where: { oid: fixture.organization.oid }
    });
    expect(row.auditLogRetentionInDays).toBe(fixture.organization.auditLogRetentionInDays);
  });

  it('keeps every entry of organizations without or within their retention', async () => {
    let [unlimited, long] = await Promise.all([
      loadOrganizationFixture(unlimitedOrg.ids),
      loadOrganizationFixture(longOrg.ids)
    ]);
    expect(unlimited.organization.auditLogRetentionInDays).toBeNull();

    await auditLogRetentionService.updateAuditLogRetention({
      organization: long.organization,
      auditScope: long.auditScope,
      input: { auditLogRetentionInDays: 3650 }
    });

    let rows = await recordEntries(
      [
        { fixture: unlimited, recordedAt: daysAgo(400) },
        { fixture: long, recordedAt: daysAgo(400) }
      ],
      uniqueId('e2e-retention-keep')
    );

    for (let organizationId of [unlimitedOrg.ids.organizationId, longOrg.ids.organizationId]) {
      let jobId = uniqueId('e2e-audit-retention-org');
      await cleanupOrganizationAuditLogsQueue.add({ organizationId }, { id: jobId });
      await waitForQueueJob(cleanupOrganizationAuditLogsQueue.name, jobId);
    }

    expect(await db.auditLog.count({ where: { id: { in: rows.map(row => row.id) } } })).toBe(
      2
    );
    expect(await getAuditEventsByIds(rows.map(row => row.id))).toHaveLength(2);
  }, 240_000);

  it('deletes entries past the retention window of that organization only', async () => {
    let [fixture, unlimited] = await Promise.all([
      loadOrganizationFixture(org.ids),
      loadOrganizationFixture(unlimitedOrg.ids)
    ]);

    let [otherOldRow, oldRow, recentRow] = await recordEntries(
      [
        { fixture: unlimited, recordedAt: daysAgo(41) },
        { fixture, recordedAt: daysAgo(40) },
        { fixture, recordedAt: daysAgo(1) }
      ],
      uniqueId('e2e-retention')
    );
    expect(otherOldRow.organizationOid).toBe(unlimited.organization.oid);
    expect(oldRow.organizationOid).toBe(fixture.organization.oid);
    expect(recentRow.organizationOid).toBe(fixture.organization.oid);

    let oldLegacy = await createLegacyEvent(fixture, daysAgo(40));
    let recentLegacy = await createLegacyEvent(fixture, daysAgo(1));

    let updated = await auditLogRetentionService.updateAuditLogRetention({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { auditLogRetentionInDays: 30 }
    });
    expect(updated.auditLogRetentionInDays).toBe(30);

    await cleanupAuditLogOrganizationsQueue.add({}, { id: uniqueId('e2e-audit-retention') });

    await eventually(
      async () => {
        expect(await db.auditLog.findUnique({ where: { id: oldRow.id } })).toBeNull();
        expect(await db.auditLogEvent.findUnique({ where: { id: oldLegacy.id } })).toBeNull();
        expect(await getAuditEventsByIds([oldRow.id])).toEqual([]);
      },
      { timeoutMs: 90_000, intervalMs: 1_000 }
    );

    let remaining = await db.auditLog.findMany({
      where: { id: { in: [recentRow.id, otherOldRow.id] } }
    });
    expect(remaining).toHaveLength(2);
    expect(await getAuditEventsByIds([recentRow.id, otherOldRow.id])).toHaveLength(2);
    expect(
      await db.auditLogEvent.findUnique({ where: { id: recentLegacy.id } })
    ).not.toBeNull();

    let bootstrapEntries = await db.auditLog.count({
      where: { organizationOid: fixture.organization.oid, recordedAt: { gte: daysAgo(30) } }
    });
    expect(bootstrapEntries).toBeGreaterThan(1);
  }, 300_000);
});
