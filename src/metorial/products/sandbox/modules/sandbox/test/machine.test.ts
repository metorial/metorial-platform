import { beforeEach, describe, expect, it, vi } from 'vitest';

let makeGenesis = () => ({
  machine: {
    create: vi.fn(),
    getMany: vi.fn(),
    terminate: vi.fn(),
    start: vi.fn()
  }
});

let genesisByRegion: Record<string, ReturnType<typeof makeGenesis>> = {
  'aws:us-east-1': makeGenesis(),
  'aws:eu-west-1': makeGenesis()
};

let db = {
  sandboxMachine: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  sandboxMachineImageRegion: { findFirst: vi.fn() },
  sandboxDisk: { count: vi.fn() }
};

vi.mock('../src/lib/regions', () => ({
  getRegionClient: vi.fn((id: string) => genesisByRegion[id])
}));
vi.mock('@metorial/db', () => ({ db }));
vi.mock('../src/services/region', () => ({
  sandboxRegionService: { getByIdentifier: vi.fn() }
}));
vi.mock('../src/services/spec', () => ({ sandboxSpecService: { resolve: vi.fn() } }));
vi.mock('../src/services/tenant', () => ({ sandboxTenantService: { ensure: vi.fn() } }));

let { sandboxMachineService } = await import('../src/services/machine');
let { sandboxRegionService } = await import('../src/services/region');
let { sandboxSpecService } = await import('../src/services/spec');
let { sandboxTenantService } = await import('../src/services/tenant');

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
let instance = { oid: 7n, projectOid: 6n, organizationOid: 5n } as any;

describe('sandboxMachineService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (sandboxRegionService.getByIdentifier as any).mockResolvedValue(useast);
    (sandboxTenantService.ensure as any).mockResolvedValue(tenant('sbt_us', useast));
    (sandboxSpecService.resolve as any).mockResolvedValue({
      spec: { memoryMiB: 2048, vcpus: 2 }
    });
    db.sandboxMachineImageRegion.findFirst.mockResolvedValue({ genesisId: 'sbi_regional' });
    genesisByRegion['aws:us-east-1']!.machine.create.mockResolvedValue({ id: 'sbm_1' });
    db.sandboxMachine.create.mockImplementation(async (a: any) => a.data);
  });

  it('maps the global image and spec to the region and records the machine', async () => {
    let result = await sandboxMachineService.create({
      instance,
      regionIdentifier: 'us-east-1',
      input: { name: 'm', imageId: 'sbi_global', specId: 'sbs_global' }
    });

    expect(genesisByRegion['aws:us-east-1']!.machine.create).toHaveBeenCalledWith({
      tenantId: 'sbt_us',
      name: 'm',
      image: { imageId: 'sbi_regional' },
      spec: { memoryMiB: 2048, vcpus: 2 }
    });
    expect(db.sandboxMachine.create.mock.calls[0]![0].data).toMatchObject({
      id: 'sbm_1',
      instanceOid: 7n
    });
    expect(result.remote).toEqual({ id: 'sbm_1' });
  });

  it('rejects an image that does not exist in the region', async () => {
    db.sandboxMachineImageRegion.findFirst.mockResolvedValue(null);

    await expect(
      sandboxMachineService.create({
        instance,
        regionIdentifier: 'us-east-1',
        input: { imageId: 'sbi_global', specId: 'sbs_global' }
      })
    ).rejects.toThrow(/not available in region/);
    expect(genesisByRegion['aws:us-east-1']!.machine.create).not.toHaveBeenCalled();
  });

  it('rejects mounts of disks outside the region tenant', async () => {
    db.sandboxDisk.count.mockResolvedValue(0);

    await expect(
      sandboxMachineService.create({
        instance,
        regionIdentifier: 'us-east-1',
        input: {
          imageId: 'sbi_global',
          specId: 'sbs_global',
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
        regionIdentifier: 'us-east-1',
        input: { imageId: 'sbi_global', specId: 'sbs_global' }
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

    expect(page.items.map(item => [item.id, item.remote?.status])).toEqual([
      ['a', 'running'],
      ['b', 'running'],
      ['c', 'paused']
    ]);
    expect(genesisByRegion['aws:us-east-1']!.machine.getMany).toHaveBeenCalledTimes(1);
    expect(genesisByRegion['aws:eu-west-1']!.machine.getMany).toHaveBeenCalledTimes(1);
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
