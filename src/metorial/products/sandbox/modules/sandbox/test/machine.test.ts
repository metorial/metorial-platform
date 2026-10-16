import { beforeEach, describe, expect, it, vi } from 'vitest';

let makeGenesis = () => ({
  machine: {
    create: vi.fn(),
    getMany: vi.fn(),
    list: vi.fn(),
    terminate: vi.fn(),
    update: vi.fn(),
    start: vi.fn(),
    access: { setPublicPorts: vi.fn() }
  }
});

let genesisByRegion: Record<string, ReturnType<typeof makeGenesis>> = {
  'aws:us-east-1': makeGenesis(),
  'aws:eu-west-1': makeGenesis()
};

let db = {
  sandboxMachine: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  sandboxMachineImageRegion: { findFirst: vi.fn() },
  sandboxTenant: { findMany: vi.fn() },
  sandboxDisk: { count: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() }
};

vi.mock('../src/lib/regions', () => ({
  getRegionClient: vi.fn((id: string) => genesisByRegion[id])
}));
vi.mock('@metorial/db', () => ({ db }));
vi.mock('../src/queues/search', () => ({
  indexSandboxImageQueue: { add: vi.fn() },
  indexSandboxMachineQueue: { add: vi.fn() }
}));
vi.mock('../src/services/region', () => ({
  sandboxRegionService: { getByIdentifier: vi.fn() }
}));
vi.mock('../src/services/spec', () => ({ sandboxSpecService: { resolve: vi.fn() } }));
vi.mock('../src/internal/machineEgressInternal', () => ({
  sandboxMachineEgressInternalService: {
    prepare: vi.fn(async () => ({ policy: null, region: null })),
    attach: vi.fn(),
    setFirewalls: vi.fn()
  }
}));
let search = { enabled: false, searchSandboxMachineIds: vi.fn() };

vi.mock('@metorial/module-search', () => ({
  isSearchEnabled: () => search.enabled,
  searchSandboxMachineIds: search.searchSandboxMachineIds
}));
vi.mock('../src/services/tenant', () => ({ sandboxTenantService: { ensure: vi.fn() } }));

let { sandboxMachineService } = await import('../src/services/machine');
let { sandboxRegionService } = await import('../src/services/region');
let { sandboxSpecService } = await import('../src/services/spec');
let { sandboxTenantService } = await import('../src/services/tenant');
let { sandboxMachineEgressInternalService } =
  await import('../src/internal/machineEgressInternal');

let region = (id: string, oid: bigint) => ({ oid, id, identifier: id.split(':')[1] });

let tenant = (id: string, regionRow: ReturnType<typeof region>) => ({
  oid: regionRow.oid + 100n,
  id,
  slug: id,
  organizationOid: 5n,
  projectOid: 6n,
  region: regionRow
});

let useast = region('aws:us-east-1', 1n);
let euwest = region('aws:eu-west-1', 2n);
let organization = { oid: 5n } as any;
let instance = { oid: 7n, id: 'ins_1', projectOid: 6n, organizationOid: 5n } as any;

describe('sandboxMachineService.create', () => {
  it('stores metadata locally without sending it to Genesis', async () => {
    let result = await sandboxMachineService.create({
      instance,
      organization,
      regionIdentifier: 'us-east-1',
      input: {
        imageId: 'sbi_global',
        spec: { specId: 'sbs_global' },
        metadata: { app: 'test' }
      }
    });

    expect(result.metadata).toEqual({ app: 'test' });
    expect(
      genesisByRegion['aws:us-east-1']!.machine.create.mock.calls[0]![0]
    ).not.toHaveProperty('metadata');
  });

  beforeEach(() => {
    vi.clearAllMocks();

    (sandboxRegionService.getByIdentifier as any).mockResolvedValue(useast);
    (sandboxTenantService.ensure as any).mockResolvedValue(tenant('sbt_us', useast));
    (sandboxSpecService.resolve as any).mockResolvedValue({
      spec: { memoryMiB: 2048, vcpus: 2 }
    });
    db.sandboxMachineImageRegion.findFirst.mockResolvedValue({
      genesisId: 'sbi_regional',
      imageOid: 12n
    });
    genesisByRegion['aws:us-east-1']!.machine.create.mockResolvedValue({
      id: 'sbm_1',
      rootFs: { desired: null, current: null }
    });
    db.sandboxMachine.create.mockImplementation(async (a: any) => ({ oid: 30n, ...a.data }));
  });

  it('maps the global image and spec to the region and records the machine', async () => {
    let result = await sandboxMachineService.create({
      instance,
      organization,
      regionIdentifier: 'us-east-1',
      input: { name: 'm', imageId: 'sbi_global', spec: { specId: 'sbs_global' } }
    });

    expect(genesisByRegion['aws:us-east-1']!.machine.create).toHaveBeenCalledWith({
      tenantId: 'sbt_us',
      name: 'm',
      image: { imageId: 'sbi_regional' },
      spec: { memoryMiB: 2048, vcpus: 2 }
    });
    expect(db.sandboxMachine.create.mock.calls[0]![0].data).toMatchObject({
      id: 'sbm_1',
      instanceOid: 7n,
      imageOid: 12n
    });
    expect(result.remote).toMatchObject({ id: 'sbm_1' });
  });

  it('creates the machine with the regional egress policy of its firewalls', async () => {
    let prepared = {
      policy: { oid: 90n },
      region: { oid: 91n, genesisId: 'snp_regional' }
    };
    (sandboxMachineEgressInternalService.prepare as any).mockResolvedValue(prepared);

    await sandboxMachineService.create({
      instance,
      organization,
      regionIdentifier: 'us-east-1',
      input: {
        imageId: 'sbi_global',
        spec: { specId: 'sbs_global' },
        firewallIds: ['fwl_1', 'fwl_1', 'fwl_2']
      }
    });

    expect(sandboxMachineEgressInternalService.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ instance, firewallIds: ['fwl_1', 'fwl_2'] })
    );
    expect(genesisByRegion['aws:us-east-1']!.machine.create).toHaveBeenCalledWith(
      expect.objectContaining({ egressPolicyId: 'snp_regional' })
    );
    expect(
      genesisByRegion['aws:us-east-1']!.machine.create.mock.calls[0]![0]
    ).not.toHaveProperty('firewallIds');
    expect(sandboxMachineEgressInternalService.attach).toHaveBeenCalledWith(
      expect.objectContaining({ firewallIds: ['fwl_1', 'fwl_2'], prepared, applied: true })
    );
  });

  it('records the root filesystem disks the machine reports, right away', async () => {
    genesisByRegion['aws:us-east-1']!.machine.create.mockResolvedValue({
      id: 'sbm_1',
      rootFs: { desired: { diskId: 'sbd_root1', diskSizeBytes: '17179869184' }, current: null }
    });

    await sandboxMachineService.create({
      instance,
      organization,
      regionIdentifier: 'us-east-1',
      input: { imageId: 'sbi_global', spec: { specId: 'sbs_global' } }
    });

    expect(db.sandboxDisk.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: 'sbd_root1',
          type: 'root_fs',
          sizeBytes: 17179869184n,
          instanceOid: 7n
        })
      ],
      skipDuplicates: true
    });
  });

  it('rejects an image that does not exist in the region', async () => {
    db.sandboxMachineImageRegion.findFirst.mockResolvedValue(null);

    await expect(
      sandboxMachineService.create({
        instance,
        organization,
        regionIdentifier: 'us-east-1',
        input: { imageId: 'sbi_global', spec: { specId: 'sbs_global' } }
      })
    ).rejects.toThrow(/not available in region/);
    expect(genesisByRegion['aws:us-east-1']!.machine.create).not.toHaveBeenCalled();
  });

  it('rejects mounts of disks outside the region tenant', async () => {
    db.sandboxDisk.count.mockResolvedValue(0);

    await expect(
      sandboxMachineService.create({
        instance,
        organization,
        regionIdentifier: 'us-east-1',
        input: {
          imageId: 'sbi_global',
          spec: { specId: 'sbs_global' },
          mounts: [{ diskId: 'sbd_1', mountPath: '/data' }]
        }
      })
    ).rejects.toThrow(/Every mounted disk/);
  });

  it('terminates the Genesis machine when recording it fails', async () => {
    db.sandboxMachine.create.mockRejectedValue(new Error('db down'));

    await expect(
      sandboxMachineService.create({
        instance,
        organization,
        regionIdentifier: 'us-east-1',
        input: { imageId: 'sbi_global', spec: { specId: 'sbs_global' } }
      })
    ).rejects.toThrow('db down');

    expect(genesisByRegion['aws:us-east-1']!.machine.terminate).toHaveBeenCalledWith({
      tenantId: 'sbt_us',
      machineId: 'sbm_1'
    });
  });
});

describe('sandboxMachineService.get', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves the region from the stored tenant and hydrates', async () => {
    db.sandboxMachine.findFirst.mockResolvedValue({
      oid: 1n,
      id: 'sbm_eu',
      status: 'active',
      tenant: tenant('sbt_eu', euwest)
    });
    genesisByRegion['aws:eu-west-1']!.machine.getMany.mockResolvedValue([
      { id: 'sbm_eu', status: 'running' }
    ]);

    let machine = await sandboxMachineService.get({ instance, machineId: 'sbm_eu' });

    expect(machine.remote).toEqual({ id: 'sbm_eu', status: 'running' });
    expect(genesisByRegion['aws:eu-west-1']!.machine.getMany).toHaveBeenCalledWith({
      tenantId: 'sbt_eu',
      ids: ['sbm_eu']
    });
    expect(genesisByRegion['aws:us-east-1']!.machine.getMany).not.toHaveBeenCalled();
  });

  it('still returns a deleted machine, without a remote once Genesis dropped it', async () => {
    db.sandboxMachine.findFirst.mockResolvedValue({
      oid: 1n,
      id: 'sbm_gone',
      status: 'deleted',
      tenant: tenant('sbt_eu', euwest)
    });
    genesisByRegion['aws:eu-west-1']!.machine.getMany.mockResolvedValue([]);

    let machine = await sandboxMachineService.get({ instance, machineId: 'sbm_gone' });

    expect(db.sandboxMachine.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sbm_gone', instanceOid: 7n } })
    );
    expect(machine.status).toBe('deleted');
    expect(machine.remote).toBeNull();
  });

  it('throws not found for an unknown machine', async () => {
    db.sandboxMachine.findFirst.mockResolvedValue(null);

    await expect(sandboxMachineService.get({ instance, machineId: 'nope' })).rejects.toThrow();
  });
});

describe('sandboxMachineService.list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hydrates machines across regions with one call per regional tenant', async () => {
    let us = tenant('sbt_us', useast);
    let eu = tenant('sbt_eu', euwest);

    (db as any).sandboxMachine.findMany = vi.fn().mockResolvedValue([
      { oid: 1n, id: 'a', status: 'active', tenant: us },
      { oid: 2n, id: 'b', status: 'active', tenant: eu },
      { oid: 3n, id: 'c', status: 'active', tenant: us }
    ]);
    genesisByRegion['aws:us-east-1']!.machine.getMany.mockResolvedValue([
      { id: 'a', status: 'running' },
      { id: 'c', status: 'paused' }
    ]);
    genesisByRegion['aws:eu-west-1']!.machine.getMany.mockResolvedValue([
      { id: 'b', status: 'running' }
    ]);

    let paginator = await sandboxMachineService.list({ instance });
    let page = await paginator.run({});

    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instanceOid: 7n, status: 'active' } })
    );

    expect(page.items.map(item => [item.id, item.remote?.status])).toEqual([
      ['a', 'running'],
      ['b', 'running'],
      ['c', 'paused']
    ]);
    expect(genesisByRegion['aws:us-east-1']!.machine.getMany).toHaveBeenCalledTimes(1);
    expect(genesisByRegion['aws:eu-west-1']!.machine.getMany).toHaveBeenCalledTimes(1);
  });
});

describe('sandboxMachineService.list filters', () => {
  it('combines IDs with the search filter', async () => {
    await (
      await sandboxMachineService.list({ instance, machineIds: ['sbm_1'], search: 'sbm' })
    ).run({});

    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { contains: 'sbm', mode: 'insensitive' },
          AND: [{ id: { in: ['sbm_1'] } }]
        })
      })
    );
  });

  it('keeps an empty ID filter', async () => {
    await (await sandboxMachineService.list({ instance, machineIds: [] })).run({});

    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: [{ id: { in: [] } }] })
      })
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    search.enabled = false;
    (db as any).sandboxMachine.findMany = vi.fn().mockResolvedValue([]);
  });

  it('filters by the images the machines boot from', async () => {
    let paginator = await sandboxMachineService.list({
      instance,
      imageIds: ['sbi_1', 'sbi_2']
    });
    await paginator.run({});

    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instanceOid: 7n,
          status: 'active',
          image: { id: { in: ['sbi_1', 'sbi_2'] } }
        }
      })
    );
  });

  it('searches through voyager when it is configured', async () => {
    search.enabled = true;
    search.searchSandboxMachineIds.mockResolvedValue(['sbm_a', 'sbm_b']);

    let paginator = await sandboxMachineService.list({ instance, search: ' web ' });
    await paginator.run({});

    expect(search.searchSandboxMachineIds).toHaveBeenCalledWith({
      instanceId: instance.id,
      query: 'web'
    });
    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instanceOid: 7n, status: 'active', id: { in: ['sbm_a', 'sbm_b'] } }
      })
    );
  });

  it('falls back to matching the id when voyager is not configured', async () => {
    let paginator = await sandboxMachineService.list({ instance, search: 'sbm_a' });
    await paginator.run({});

    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instanceOid: 7n,
          status: 'active',
          id: { contains: 'sbm_a', mode: 'insensitive' }
        }
      })
    );
  });

  it('filters by the regions the machines run in', async () => {
    let paginator = await sandboxMachineService.list({
      instance,
      regionIdentifiers: ['us-east-1', 'eu-west-1']
    });
    await paginator.run({});

    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instanceOid: 7n,
          status: 'active',
          tenant: { region: { identifier: { in: ['us-east-1', 'eu-west-1'] } } }
        }
      })
    );
  });

  it('filters by runtime status using the ids every regional tenant reports', async () => {
    let us = tenant('sbt_us', useast);
    let eu = tenant('sbt_eu', euwest);
    db.sandboxTenant.findMany.mockResolvedValue([us, eu]);
    genesisByRegion['aws:us-east-1']!.machine.list.mockResolvedValue({
      items: [{ id: 'sbm_a' }, { id: 'sbm_b' }],
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    });
    genesisByRegion['aws:eu-west-1']!.machine.list.mockResolvedValue({
      items: [{ id: 'sbm_c' }],
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    });

    let paginator = await sandboxMachineService.list({
      instance,
      states: ['running', 'paused']
    });
    await paginator.run({});

    expect(db.sandboxTenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { machines: { some: { instanceOid: 7n } } } })
    );
    expect(genesisByRegion['aws:us-east-1']!.machine.list).toHaveBeenCalledWith({
      tenantId: 'sbt_us',
      status: ['running', 'paused'],
      limit: 100,
      after: undefined
    });
    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instanceOid: 7n,
          status: 'active',
          AND: [{ id: { in: ['sbm_a', 'sbm_b', 'sbm_c'] } }]
        }
      })
    );
  });

  it('pages through the regional machines of a runtime status and limits the tenants to the region', async () => {
    db.sandboxTenant.findMany.mockResolvedValue([tenant('sbt_us', useast)]);
    genesisByRegion['aws:us-east-1']!.machine.list.mockResolvedValueOnce({
      items: [{ id: 'sbm_a' }, { id: 'sbm_b' }],
      pagination: { hasMoreAfter: true, hasMoreBefore: false }
    }).mockResolvedValueOnce({
      items: [{ id: 'sbm_c' }],
      pagination: { hasMoreAfter: false, hasMoreBefore: true }
    });

    let paginator = await sandboxMachineService.list({
      instance,
      states: ['failed'],
      regionIdentifiers: ['us-east-1']
    });
    await paginator.run({});

    expect(db.sandboxTenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          machines: { some: { instanceOid: 7n } },
          region: { identifier: { in: ['us-east-1'] } }
        }
      })
    );
    expect(genesisByRegion['aws:us-east-1']!.machine.list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ after: 'sbm_b' })
    );
    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ id: { in: ['sbm_a', 'sbm_b', 'sbm_c'] } }]
        })
      })
    );
  });

  it('matches nothing when no machine has the requested runtime status', async () => {
    db.sandboxTenant.findMany.mockResolvedValue([tenant('sbt_us', useast)]);
    genesisByRegion['aws:us-east-1']!.machine.list.mockResolvedValue({
      items: [],
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    });

    let paginator = await sandboxMachineService.list({ instance, states: ['hibernated'] });
    await paginator.run({});

    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: [{ id: { in: [] } }] })
      })
    );
  });

  it('combines the runtime status with a search', async () => {
    search.enabled = true;
    search.searchSandboxMachineIds.mockResolvedValue(['sbm_a', 'sbm_z']);
    db.sandboxTenant.findMany.mockResolvedValue([tenant('sbt_us', useast)]);
    genesisByRegion['aws:us-east-1']!.machine.list.mockResolvedValue({
      items: [{ id: 'sbm_a' }],
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    });

    let paginator = await sandboxMachineService.list({
      instance,
      states: ['running'],
      search: 'web'
    });
    await paginator.run({});

    expect((db as any).sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instanceOid: 7n,
          status: 'active',
          id: { in: ['sbm_a', 'sbm_z'] },
          AND: [{ id: { in: ['sbm_a'] } }]
        }
      })
    );
  });
});

describe('sandboxMachineService.update', () => {
  beforeEach(() => vi.clearAllMocks());

  let row = {
    oid: 1n,
    id: 'sbm_1',
    status: 'active',
    tenantOid: 101n,
    organizationOid: 5n,
    projectOid: 6n,
    instanceOid: 7n,
    instance,
    tenant: tenant('sbt_us', useast)
  } as any;

  it('returns updated local metadata without sending it or an image to Genesis', async () => {
    let regional = genesisByRegion['aws:us-east-1']!.machine;
    regional.update.mockResolvedValue({
      id: row.id,
      rootFs: { desired: null, current: null }
    });
    db.sandboxMachine.update.mockImplementation(async ({ data }) => ({ ...row, ...data }));

    let result = await sandboxMachineService.update({
      machine: row,
      organization,
      input: { metadata: {} }
    });

    expect(result.metadata).toEqual({});
    expect(regional.update).not.toHaveBeenCalled();
  });

  it('records the new root filesystem and retires the ones the machine dropped', async () => {
    genesisByRegion['aws:us-east-1']!.machine.update.mockResolvedValue({
      id: 'sbm_1',
      rootFs: {
        desired: { diskId: 'sbd_new', diskSizeBytes: '32' },
        current: { diskId: 'sbd_old', diskSizeBytes: '16' }
      }
    });

    await sandboxMachineService.update({ machine: row, input: { name: 'renamed' } });

    expect(db.sandboxDisk.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ id: 'sbd_new', sizeBytes: 32n, machineOid: 1n }),
          expect.objectContaining({ id: 'sbd_old', sizeBytes: 16n, machineOid: 1n })
        ]
      })
    );
    expect(db.sandboxDisk.updateMany).toHaveBeenCalledWith({
      where: {
        machineOid: 1n,
        type: 'root_fs',
        status: 'active',
        id: { notIn: ['sbd_new', 'sbd_old'] }
      },
      data: { status: 'deleted', deletedAt: expect.any(Date) }
    });
  });

  it('leaves root filesystem rows alone when the machine reports none', async () => {
    genesisByRegion['aws:us-east-1']!.machine.update.mockResolvedValue({
      id: 'sbm_1',
      rootFs: { desired: null, current: null }
    });

    await sandboxMachineService.update({ machine: row, input: { name: 'renamed' } });

    expect(db.sandboxDisk.updateMany).not.toHaveBeenCalled();
  });

  it('sets the public ports after updating the machine and returns the refreshed machine', async () => {
    let regional = genesisByRegion['aws:us-east-1']!.machine;
    regional.update.mockResolvedValue({
      id: 'sbm_1',
      publicPorts: [],
      rootFs: { desired: null, current: null }
    });
    regional.access.setPublicPorts.mockResolvedValue({
      id: 'sbm_1',
      publicPorts: [3000, 8080]
    });

    let result = await sandboxMachineService.update({
      machine: row,
      input: { publicPorts: [3000, 8080] }
    });

    expect(regional.update.mock.calls[0]![0]).not.toHaveProperty('publicPorts');
    expect(regional.access.setPublicPorts).toHaveBeenCalledWith({
      tenantId: 'sbt_us',
      machineId: 'sbm_1',
      ports: [3000, 8080]
    });
    expect(result.remote).toEqual({ id: 'sbm_1', publicPorts: [3000, 8080] });
  });

  it('closes every public port when given an empty list', async () => {
    let regional = genesisByRegion['aws:us-east-1']!.machine;
    regional.update.mockResolvedValue({
      id: 'sbm_1',
      rootFs: { desired: null, current: null }
    });
    regional.access.setPublicPorts.mockResolvedValue({ id: 'sbm_1', publicPorts: [] });

    await sandboxMachineService.update({ machine: row, input: { publicPorts: [] } });

    expect(regional.access.setPublicPorts).toHaveBeenCalledWith(
      expect.objectContaining({ ports: [] })
    );
  });

  it('leaves the public ports alone when none are given', async () => {
    let regional = genesisByRegion['aws:us-east-1']!.machine;
    regional.access.setPublicPorts.mockClear();
    regional.update.mockResolvedValue({
      id: 'sbm_1',
      rootFs: { desired: null, current: null }
    });

    await sandboxMachineService.update({ machine: row, input: { name: 'renamed' } });

    expect(regional.access.setPublicPorts).not.toHaveBeenCalled();
  });
});

describe('sandboxMachineService lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('terminate calls the regional Genesis and flags the row deleted', async () => {
    let row = {
      oid: 1n,
      id: 'sbm_1',
      status: 'active',
      tenant: tenant('sbt_us', useast)
    } as any;
    genesisByRegion['aws:us-east-1']!.machine.terminate.mockResolvedValue({ id: 'sbm_1' });
    db.sandboxMachine.update.mockResolvedValue({ ...row, status: 'deleted' });

    let result = await sandboxMachineService.terminate({ machine: row });

    expect(db.sandboxMachine.update.mock.calls[0]![0].data.status).toBe('deleted');
    expect(db.sandboxDisk.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { machineOid: 1n, type: 'root_fs', status: 'active' },
        data: expect.objectContaining({ status: 'deleted' })
      })
    );
    expect(result.status).toBe('deleted');
  });

  it('rejects actions on a terminated machine', async () => {
    let row = {
      oid: 1n,
      id: 'sbm_1',
      status: 'deleted',
      tenant: tenant('sbt_us', useast)
    } as any;

    await expect(sandboxMachineService.start({ machine: row })).rejects.toThrow(/terminated/);
  });
});
