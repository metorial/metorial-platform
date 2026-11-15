import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-ignore
const { db } = await import('@metorial/db');

vi.mock('@metorial/db', () => ({
  db: {
    outpost: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  },
  withTransaction: (fn: any) => fn(db),
  ID: { generateId: vi.fn().mockResolvedValue('otp_mock') }
}));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, fn: any) => ({ build: () => fn() }) }
}));
vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));
vi.mock('@metorial/module-organization', () => ({
  accountService: {
    getAccountForOrganization: vi.fn()
  }
}));
vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: (fn: any) => fn({ prisma: (cb: any) => cb({}) }) }
}));

const { accountService } = await import('@metorial/module-organization');
const { outpostService } = await import('../src/services/outpost');

const baseOrg = { oid: 1n, id: 'org_1' } as any;
let testAuditScope = {
  organizationOid: baseOrg.oid,
  actor: { type: 'org_actor' as const, id: 'actor_1' }
} as any;

describe('outpostService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an outpost owned by the calling organization', async () => {
    (accountService.getAccountForOrganization as any).mockResolvedValue({
      oid: 10n,
      rootOwnerAccountOid: null
    });
    (db.outpost.create as any).mockResolvedValue({
      oid: 100n,
      id: 'otp_1',
      status: 'active',
      organizationOid: baseOrg.oid
    });

    let outpost = await outpostService.createOutpost({
      organization: baseOrg,
      input: { name: 'My Outpost' },
      auditScope: testAuditScope
    });

    expect(outpost.id).toBe('otp_1');
    expect(db.outpost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountOid: 10n,
          organizationOid: baseOrg.oid,
          status: 'active',
          connectionStatus: 'inactive'
        })
      })
    );
  });

  it('finds an outpost family-wide, using the account family root even when the caller does not own it', async () => {
    (accountService.getAccountForOrganization as any).mockResolvedValue({
      oid: 20n,
      rootOwnerAccountOid: 5n
    });
    (db.outpost.findFirst as any).mockResolvedValue({
      oid: 200n,
      id: 'otp_2',
      status: 'active',
      organizationOid: 999n
    });

    let outpost = await outpostService.getOutpostInFamily({
      organization: baseOrg,
      outpostId: 'otp_2'
    });

    expect(outpost.id).toBe('otp_2');
    expect(db.outpost.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'otp_2',
          account: { OR: [{ oid: 5n }, { rootOwnerAccountOid: 5n }] }
        })
      })
    );
  });

  it('throws not found when getOwnedOutpostById does not match the organization', async () => {
    (db.outpost.findFirst as any).mockResolvedValue(null);

    await expect(
      outpostService.getOwnedOutpostById({ organization: baseOrg, outpostId: 'otp_3' })
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it('refuses to delete an active outpost', async () => {
    let activeOutpost = { oid: 300n, id: 'otp_4', status: 'active' } as any;

    await expect(
      outpostService.deleteOutpost({
        outpost: activeOutpost,
        organization: baseOrg,
        auditScope: testAuditScope
      })
    ).rejects.toBeInstanceOf(ServiceError);
    expect(db.outpost.update).not.toHaveBeenCalled();
  });

  it('deletes a disabled outpost', async () => {
    let disabledOutpost = { oid: 300n, id: 'otp_4', status: 'disabled' } as any;
    (db.outpost.update as any).mockResolvedValue({ ...disabledOutpost, status: 'deleted' });

    let outpost = await outpostService.deleteOutpost({
      outpost: disabledOutpost,
      organization: baseOrg,
      auditScope: testAuditScope
    });

    expect(outpost.status).toBe('deleted');
  });

  it('enables a disabled outpost', async () => {
    let disabledOutpost = { oid: 300n, id: 'otp_4', status: 'disabled' } as any;
    (db.outpost.update as any).mockResolvedValue({ ...disabledOutpost, status: 'active' });

    let outpost = await outpostService.enableOutpost({
      outpost: disabledOutpost,
      organization: baseOrg,
      auditScope: testAuditScope
    });

    expect(outpost.status).toBe('active');
    expect(db.outpost.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'active' } })
    );
  });
});
