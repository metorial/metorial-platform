import { getAuditEventsByIds } from '@metorial/audit-models';
import {
  eventually,
  expectOk,
  expectServiceError,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditLogService, type AuditLog } from '../src';
import { listAllAuditLogs, listAuditLogPage, payloadId } from './_fixtures';

describe('module-audit-log trail', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let state: {
    memberKey: any;
    managementKey: any;
    originalName: string;
    renamedName: string;
    trail: AuditLog[];
  };

  let dashboardPath = (path: string) =>
    `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let findEntry = (apiKeyId: string, action: string) => {
    let entry = state.trail.find(
      item =>
        item.resource == 'api_key' && item.action == action && payloadId(item) == apiKeyId
    );
    if (!entry) throw new Error(`No api_key.${action} audit log for ${apiKeyId}`);
    return entry;
  };

  beforeAll(async () => {
    let originalName = uniqueId('audit-member-key');
    let renamedName = uniqueId('audit-member-key-renamed');

    let memberKey = expectOk(
      await org.clients.rest.post(dashboardPath('/api-keys'), {
        type: 'instance_access_token_secret',
        instance_id: org.ids.instanceId,
        name: originalName,
        description: 'Audit e2e'
      })
    );
    expectOk(
      await org.clients.rest.post(dashboardPath(`/api-keys/${memberKey.id}`), {
        name: renamedName
      })
    );

    let managementKey = expectOk(
      await org.clients.management.post('/organization/api-keys', {
        type: 'instance_access_token_secret',
        instance_id: org.ids.instanceId,
        name: uniqueId('audit-management-key')
      })
    );
    let revealed = expectOk(
      await org.clients.management.post(`/organization/api-keys/${memberKey.id}/reveal`)
    );
    expect(revealed.secret).toBe(memberKey.secret);

    let trail = await eventually(
      async () => {
        let items = await listAllAuditLogs(org.ids.organizationId);
        let recorded = items
          .filter(item => item.resource == 'api_key')
          .map(item => `${payloadId(item)}.${item.action}`);
        expect(recorded).toEqual(
          expect.arrayContaining([
            `${memberKey.id}.create`,
            `${memberKey.id}.update`,
            `${memberKey.id}.reveal`,
            `${managementKey.id}.create`
          ])
        );
        return items;
      },
      { timeoutMs: 150_000, intervalMs: 2_000 }
    );

    state = { memberKey, managementKey, originalName, renamedName, trail };
  }, 180_000);

  it('attributes a dashboard action to the member and scopes it to the key instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let entry = findEntry(state.memberKey.id, 'create');

    expect(entry).toMatchObject({
      resource: 'api_key',
      action: 'create',
      organizationId: org.ids.organizationId,
      instanceId: org.ids.instanceId,
      organizationActorId: fixture.actor.id,
      actor: {
        type: 'org_actor',
        id: fixture.actor.id,
        record: {
          object: 'organization_actor',
          id: fixture.actor.id,
          type: 'member',
          member: { id: fixture.member.id, status: 'active' }
        }
      },
      payload: {
        id: state.memberKey.id,
        type: 'instance_access_token_secret',
        status: 'active',
        name: state.originalName,
        description: 'Audit e2e'
      }
    });
    expect(entry.context.ip).toEqual(expect.any(String));
    expect(entry.recordedAt).toBeInstanceOf(Date);
    expect(entry.previousAttributes).toBeUndefined();

    let row = await db.auditLog.findUniqueOrThrow({ where: { id: entry.id } });
    expect(row).toMatchObject({
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      organizationActorOid: fixture.actor.oid,
      actorType: 'org_actor',
      actorId: fixture.actor.id
    });
  });

  it('attributes a management key action to the key machine actor, not a member', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let managementApiKey = await db.apiKey.findFirstOrThrow({
      where: {
        type: 'organization_management_token',
        name: { startsWith: 'e2e-management' },
        machineAccess: { organizationOid: fixture.organization.oid }
      },
      include: { machineAccess: { include: { actor: true } } }
    });
    let managementActor = managementApiKey.machineAccess.actor!;
    let entry = findEntry(state.managementKey.id, 'create');

    expect(managementActor.id).not.toBe(fixture.actor.id);
    expect(entry).toMatchObject({
      instanceId: org.ids.instanceId,
      organizationActorId: managementActor.id,
      actor: {
        type: 'org_actor',
        id: managementActor.id,
        record: { type: 'machine_access', id: managementActor.id }
      }
    });
    expect((entry.actor!.record as any).member).toBeUndefined();

    let reveal = findEntry(state.memberKey.id, 'reveal');
    expect(reveal.actor!.id).toBe(managementActor.id);
  });

  it('stores only the changed attributes of an update', () => {
    let entry = findEntry(state.memberKey.id, 'update');

    expect(entry.payload).toMatchObject({
      id: state.memberKey.id,
      name: state.renamedName,
      description: 'Audit e2e'
    });
    expect(entry.previousAttributes).toEqual({ name: state.originalName });
  });

  it('never stores API key secrets in the audit trail', async () => {
    let entries = state.trail.filter(
      item =>
        item.resource == 'api_key' &&
        [state.memberKey.id, state.managementKey.id].includes(payloadId(item)!)
    );
    expect(entries.length).toBeGreaterThanOrEqual(4);

    let documents = await getAuditEventsByIds(entries.map(entry => entry.id));
    expect(documents).toHaveLength(entries.length);

    let stored = JSON.stringify({ entries, documents });
    expect(stored).not.toContain(state.memberKey.secret);
    expect(stored).not.toContain(state.managementKey.secret);
    for (let entry of entries) {
      expect(Object.keys(entry.payload as object)).not.toContain('secret');
    }
  });

  it('records organization-level actions without an instance', () => {
    let entry = state.trail.find(
      item => item.resource == 'project' && item.action == 'create'
    );

    expect(entry).toBeDefined();
    expect(entry!.instanceId).toBeUndefined();
    expect(entry!.payload).toMatchObject({ id: org.ids.projectId });
  });

  it('pages through the whole trail without gaps or duplicates', async () => {
    await eventually(
      async () => {
        let everything = await listAllAuditLogs(org.ids.organizationId);
        let paged = await listAllAuditLogs(org.ids.organizationId, 2);
        let ids = paged.map(item => item.id);

        expect(everything.length).toBeGreaterThanOrEqual(state.trail.length);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toEqual(everything.map(item => item.id));
      },
      { timeoutMs: 30_000, intervalMs: 2_000 }
    );

    let first = await listAuditLogPage(org.ids.organizationId, { limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.pagination.hasNextPage).toBe(true);
  });

  it('resolves the organization by slug as well as by id', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let entry = findEntry(state.memberKey.id, 'create');

    let bySlug = await auditLogService.getAuditLog({
      organizationId: fixture.organization.slug,
      auditLogId: entry.id
    });
    expect(bySlug.id).toBe(entry.id);
  });

  it('never exposes an organization trail to another organization', async () => {
    let entry = findEntry(state.memberKey.id, 'create');

    let otherTrail = await listAllAuditLogs(otherOrg.ids.organizationId);
    expect(otherTrail.length).toBeGreaterThan(0);
    expect(otherTrail.every(item => item.organizationId == otherOrg.ids.organizationId)).toBe(
      true
    );
    expect(otherTrail.map(item => item.id)).not.toContain(entry.id);

    await expectServiceError(
      auditLogService.getAuditLog({
        organizationId: otherOrg.ids.organizationId,
        auditLogId: entry.id
      }),
      'not_found'
    );
    await expectServiceError(
      auditLogService.getAuditLog({
        organizationId: uniqueId('org_missing'),
        auditLogId: entry.id
      }),
      'not_found'
    );
    await expectServiceError(
      auditLogService.listAuditLogs({ organizationId: uniqueId('org_missing') }),
      'not_found'
    );
  });

  it('streams an organization trail in insertion order from a time and cursor', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let all = await auditLogService.listAuditLogsForStream({
      organizationOid: fixture.organization.oid,
      recordedAtGte: new Date(0),
      limit: 1_000
    });
    let rows = await db.auditLog.findMany({
      where: { organizationOid: fixture.organization.oid },
      orderBy: { oid: 'asc' },
      select: { id: true, oid: true }
    });

    expect(all.items.length).toBeGreaterThanOrEqual(4);
    expect(all.items.length).toBeLessThanOrEqual(100);
    expect(all.items.map(item => item.id)).toEqual(
      rows.slice(0, all.items.length).map(row => row.id)
    );
    expect(all.items.every(item => item.organizationId == org.ids.organizationId)).toBe(true);

    let afterSecond = await auditLogService.listAuditLogsForStream({
      organizationOid: fixture.organization.oid,
      recordedAtGte: new Date(0),
      afterOid: rows[1]!.oid,
      limit: 2
    });
    expect(afterSecond.items.map(item => item.id)).toEqual([rows[2]!.id, rows[3]!.id]);
    expect(afterSecond.lastAuditLogOid).toBe(rows[3]!.oid);

    let future = await auditLogService.listAuditLogsForStream({
      organizationOid: fixture.organization.oid,
      recordedAtGte: new Date(Date.now() + 60 * 60 * 1000),
      limit: 10
    });
    expect(future).toEqual({ items: [], lastAuditLogOid: null });
  });
});
