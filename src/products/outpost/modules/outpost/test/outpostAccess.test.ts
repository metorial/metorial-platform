import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-ignore
const { db } = await import('@metorial/db');

vi.mock('@metorial/db', () => ({
  db: {
    outpostAccess: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn()
    },
    organization: { findUnique: vi.fn() },
    instance: { findUnique: vi.fn() }
  },
  withTransaction: (fn: any) => fn(db),
  ID: { generateId: vi.fn().mockResolvedValue('ota_mock') }
}));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, fn: any) => ({ build: () => fn() }) }
}));
vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));
vi.mock('@metorial/module-organization', () => ({
  instanceService: { getManyInstancesForOrganization: vi.fn() }
}));
vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: (fn: any) => fn({ prisma: (cb: any) => cb({}) }) }
}));
// `../lib/cache` initializes Redis-backed cached functions at import time -- stub it out so
// this test doesn't need a live Redis/env setup.
const cachedInstanceAccessGrant = vi.fn();
vi.mock('../src/lib/cache', () => ({ cachedInstanceAccessGrant }));

const { instanceService } = await import('@metorial/module-organization');
const { outpostAccessService } = await import('../src/services/outpostAccess');

const baseOrg = { oid: 1n, id: 'org_1' } as any;
const baseOutpost = { oid: 100n, id: 'otp_1' } as any;
let testAuditScope = {
  organizationOid: baseOrg.oid,
  actor: { type: 'org_actor' as const, id: 'actor_1' }
} as any;

describe('outpostAccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a grant for an instance that does not belong to the organization', async () => {
    (instanceService.getManyInstancesForOrganization as any).mockResolvedValue([]);

    await expect(
      outpostAccessService.setAccessForOrganization({
        outpost: baseOutpost,
        organization: baseOrg,
        grants: [{ instanceId: 'ins_unknown', services: ['mcp_connection_proxy'] }],
        auditScope: testAuditScope
      })
    ).rejects.toBeInstanceOf(ServiceError);
    expect(db.outpostAccess.deleteMany).not.toHaveBeenCalled();
  });

  it('fully replaces existing grants by instance and stores the instance project oid', async () => {
    let instanceA = {
      oid: 20n,
      id: 'ins_a',
      slug: 'a',
      previousSlugs: [],
      projectOid: 10n
    } as any;
    (instanceService.getManyInstancesForOrganization as any).mockResolvedValue([instanceA]);
    (db.outpostAccess.upsert as any).mockResolvedValue({
      oid: 1000n,
      id: 'ota_1',
      projectOid: instanceA.projectOid,
      instanceOid: instanceA.oid,
      services: ['mcp_connection_proxy']
    });

    let access = await outpostAccessService.setAccessForOrganization({
      outpost: baseOutpost,
      organization: baseOrg,
      grants: [{ instanceId: 'ins_a', services: ['mcp_connection_proxy'] }],
      auditScope: testAuditScope
    });

    expect(db.outpostAccess.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          outpostOid: baseOutpost.oid,
          organizationOid: baseOrg.oid,
          instanceOid: { notIn: [instanceA.oid] }
        })
      })
    );
    expect(db.outpostAccess.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          outpostOid_instanceOid: {
            outpostOid: baseOutpost.oid,
            instanceOid: instanceA.oid
          }
        },
        create: expect.objectContaining({
          projectOid: instanceA.projectOid,
          instanceOid: instanceA.oid
        })
      })
    );
    expect(access).toHaveLength(1);
  });

  it('rejects unknown services', async () => {
    await expect(
      outpostAccessService.setAccessForOrganization({
        outpost: baseOutpost,
        organization: baseOrg,
        grants: [{ instanceId: 'ins_a', services: ['unknown_service'] as any }],
        auditScope: testAuditScope
      })
    ).rejects.toBeInstanceOf(ServiceError);

    expect(db.outpostAccess.upsert).not.toHaveBeenCalled();
  });

  it('isServiceGrantedForInstance delegates to the cached lookup and returns its verdict', async () => {
    cachedInstanceAccessGrant.mockResolvedValueOnce({ granted: true });

    let granted = await outpostAccessService.isServiceGrantedForInstance({
      outpostId: 'otp_1',
      projectOid: 42n,
      instanceOid: 84n,
      service: 'mcp_connection_proxy'
    });

    expect(granted).toBe(true);
    expect(cachedInstanceAccessGrant).toHaveBeenCalledWith({
      outpostId: 'otp_1',
      projectOid: 42n,
      instanceOid: 84n,
      service: 'mcp_connection_proxy'
    });

    cachedInstanceAccessGrant.mockResolvedValueOnce({ granted: false });
    expect(
      await outpostAccessService.isServiceGrantedForInstance({
        outpostId: 'otp_1',
        projectOid: 42n,
        instanceOid: 84n,
        service: 'mcp_connection_proxy'
      })
    ).toBe(false);
  });
});
