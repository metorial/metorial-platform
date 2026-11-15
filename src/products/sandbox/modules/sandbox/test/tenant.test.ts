import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, genesis, fire, hooks } = vi.hoisted(() => ({
  db: {
    sandboxTenant: { findFirst: vi.fn(), create: vi.fn() },
    project: { findFirstOrThrow: vi.fn() }
  },
  genesis: { tenant: { update: vi.fn() } },
  fire: vi.fn(),
  hooks: [] as Array<() => Promise<void>>
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: vi.fn(async () => 'sbt_new') },
  addAfterTransactionHook: vi.fn(async hook => {
    hooks.push(hook);
  })
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire } }));
vi.mock('../src/lib/regions', () => ({ getRegionClient: vi.fn(() => genesis) }));

let { sandboxTenantService } = await import('../src/services/tenant');

let instance = { projectOid: 2n, organizationOid: 3n } as any;

let region = { oid: 1n, id: 'aws:us-east-1' } as any;

let tenant = {
  id: 'sbt_new',
  slug: 'project',
  regionOid: region.oid,
  projectOid: instance.projectOid,
  organizationOid: instance.organizationOid,
  region
};

describe('sandboxTenantService.ensure', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hooks.length = 0;

    db.sandboxTenant.findFirst.mockResolvedValue(null);
    db.project.findFirstOrThrow.mockResolvedValue({ slug: 'project' });
    genesis.tenant.update.mockResolvedValue({ slug: 'project' });
    db.sandboxTenant.create.mockResolvedValue(tenant);
  });

  it('creates with defaults and announces the tenant only after commit', async () => {
    expect(await sandboxTenantService.ensure({ instance, region })).toEqual(tenant);

    expect(genesis.tenant.update).toHaveBeenCalledWith({
      tenantId: 'sbt_new',
      tenantSlug: 'project'
    });
    expect(fire).not.toHaveBeenCalled();
    expect(hooks).toHaveLength(1);

    await hooks[0]!();

    expect(fire).toHaveBeenCalledWith('sandbox.tenant.created:after', { tenant });
  });

  it('does not announce an existing tenant', async () => {
    db.sandboxTenant.findFirst.mockResolvedValue(tenant);

    expect(await sandboxTenantService.ensure({ instance, region })).toEqual(tenant);

    expect(genesis.tenant.update).not.toHaveBeenCalled();
    expect(hooks).toHaveLength(0);
  });

  it('does not announce the tenant created by a concurrent caller', async () => {
    db.sandboxTenant.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(tenant);
    db.sandboxTenant.create.mockRejectedValue(new Error('unique constraint'));

    expect(await sandboxTenantService.ensure({ instance, region })).toEqual(tenant);

    expect(hooks).toHaveLength(0);
  });

  it('propagates creation failures without announcing a tenant', async () => {
    let error = new Error('database unavailable');
    db.sandboxTenant.create.mockRejectedValue(error);

    await expect(sandboxTenantService.ensure({ instance, region })).rejects.toBe(error);

    expect(hooks).toHaveLength(0);
  });
});
