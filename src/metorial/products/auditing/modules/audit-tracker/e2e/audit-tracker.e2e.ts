import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { auditTrackerService } from '../src';

describe('module-audit-tracker', () => {
  let org = useOrganization();

  it('ingests recorded audit events into Postgres through the collector', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let singleUa = uniqueId('e2e-audit-single');
    let batchUa = uniqueId('e2e-audit-batch');

    await auditTrackerService.recordEvent(
      { ...fixture.auditScope, context: { ip: '127.0.0.1', ua: singleUa } },
      'organization',
      'update',
      { payload: { organization: fixture.organization } }
    );
    await auditTrackerService.recordEvents([
      {
        scope: { ...fixture.auditScope, context: { ip: '127.0.0.1', ua: batchUa } },
        resource: 'project',
        action: 'update',
        payload: { project: { ...fixture.project, organization: fixture.organization } }
      },
      {
        scope: { ...fixture.auditScope, context: { ip: '127.0.0.1', ua: batchUa } },
        resource: 'instance',
        action: 'update',
        payload: { instance: fixture.instance }
      }
    ]);

    let rows = await eventually(
      async () => {
        let rows = await db.auditLog.findMany({
          where: {
            organizationOid: fixture.organization.oid,
            ua: { in: [singleUa, batchUa] }
          }
        });
        expect(rows).toHaveLength(3);
        return rows;
      },
      { timeoutMs: 150_000, intervalMs: 2_000 }
    );

    let single = rows.find(row => row.ua == singleUa)!;
    expect(single).toMatchObject({
      resource: 'organization',
      action: 'update',
      actorType: 'org_actor',
      actorId: fixture.actor.id,
      organizationActorOid: fixture.actor.oid
    });
    expect(
      rows
        .filter(row => row.ua == batchUa)
        .map(row => row.resource)
        .sort()
    ).toEqual(['instance', 'project']);
  }, 180_000);
});
