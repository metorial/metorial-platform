import { beforeEach, describe, expect, it, vi } from 'vitest';

let { fire, updateOrganization } = vi.hoisted(() => ({
  fire: vi.fn(),
  updateOrganization: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  withTransaction: vi.fn(async callback =>
    callback({ organization: { update: updateOrganization } })
  )
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire }
}));

import { auditLogRetentionService } from './auditLogRetention';

let organization = {
  oid: 1n,
  id: 'org-1',
  status: 'active',
  auditLogRetentionInDays: 90
} as any;

describe('auditLogRetentionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOrganization.mockResolvedValue({
      ...organization,
      auditLogRetentionInDays: 30
    });
  });

  it('returns the active organization configuration', async () => {
    await expect(
      auditLogRetentionService.getAuditLogRetention({ organization })
    ).resolves.toBe(organization);
  });

  it('fires Fabric hooks around the transactional update', async () => {
    let auditScope = {} as any;

    let result = await auditLogRetentionService.updateAuditLogRetention({
      organization,
      auditScope,
      input: { auditLogRetentionInDays: 30 }
    });

    expect(fire).toHaveBeenNthCalledWith(
      1,
      'organization.audit_log_retention.updated:before',
      { organization, auditScope, input: { auditLogRetentionInDays: 30 } }
    );
    expect(updateOrganization).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { auditLogRetentionInDays: 30 }
    });
    expect(fire).toHaveBeenNthCalledWith(
      2,
      'organization.audit_log_retention.updated:after',
      expect.objectContaining({
        previousOrganization: organization,
        organization: result,
        auditScope
      })
    );
  });

  it('does not write when the before hook rejects', async () => {
    fire.mockRejectedValueOnce(new Error('plan limit'));

    await expect(
      auditLogRetentionService.updateAuditLogRetention({
        organization,
        auditScope: {} as any,
        input: { auditLogRetentionInDays: 120 }
      })
    ).rejects.toThrow('plan limit');

    expect(updateOrganization).not.toHaveBeenCalled();
  });
});
