import { eventually, firstPage, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { auditLogRetentionService, auditLogService } from '../src';

describe('module-audit-log', () => {
  let org = useOrganization();

  it('lists and hydrates the audit logs recorded while bootstrapping the organization', async () => {
    let auditLogs = await eventually(
      async () => {
        let items = await firstPage(
          await auditLogService.listAuditLogs({ organizationId: org.ids.organizationId })
        );
        expect(items.map(item => `${item.resource}.${item.action}`)).toContain(
          'project.create'
        );
        return items;
      },
      { timeoutMs: 150_000, intervalMs: 2_000 }
    );
    expect(auditLogs.every(item => item.organizationId == org.ids.organizationId)).toBe(true);

    let projectLog = auditLogs.find(
      item => item.resource == 'project' && item.action == 'create'
    )!;
    let auditLog = await auditLogService.getAuditLog({
      organizationId: org.ids.organizationId,
      auditLogId: projectLog.id
    });
    expect(auditLog.id).toBe(projectLog.id);
    expect(auditLog.payload).toMatchObject({ id: org.ids.projectId });

    await expect(
      auditLogService.getAuditLog({
        organizationId: org.ids.organizationId,
        auditLogId: 'aud_does_not_exist'
      })
    ).rejects.toThrow();
  }, 180_000);

  it('reads and updates the audit log retention of an organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let current = await auditLogRetentionService.getAuditLogRetention({
      organization: fixture.organization
    });
    expect(current.id).toBe(org.ids.organizationId);

    let updated = await auditLogRetentionService.updateAuditLogRetention({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { auditLogRetentionInDays: 45 }
    });
    expect(updated.auditLogRetentionInDays).toBe(45);

    let reloaded = await loadOrganizationFixture(org.ids);
    expect(reloaded.organization.auditLogRetentionInDays).toBe(45);
  });
});
