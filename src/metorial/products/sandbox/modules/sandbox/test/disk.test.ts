import { beforeEach, describe, expect, it, vi } from 'vitest';

let genesis = {
  disk: {
    create: vi.fn(),
    clone: vi.fn(),
    delete: vi.fn(),
    getMany: vi.fn(),
    mounts: vi.fn(),
    resize: vi.fn(),
    resizeGet: vi.fn(),
    resizeList: vi.fn(),
    resizeRetry: vi.fn()
  },
  machine: { getMany: vi.fn() }
};

let db = {
  sandboxDisk: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  sandboxMachine: { findMany: vi.fn() }
};

let indexDisk = vi.fn();

let search = { isSearchEnabled: vi.fn(), searchSandboxDiskIds: vi.fn() };

vi.mock('../src/queues/search', () => ({ indexSandboxDiskQueue: { add: indexDisk } }));
vi.mock('@metorial/module-search', () => search);

vi.mock('../src/lib/regions', () => ({ getRegionClient: vi.fn(() => genesis) }));
vi.mock('@metorial/db', () => ({ db }));
vi.mock('../src/services/region', () => ({
  sandboxRegionService: { getByIdentifier: vi.fn() }
}));
vi.mock('../src/services/tenant', () => ({ sandboxTenantService: { ensure: vi.fn() } }));

let { sandboxDiskService } = await import('../src/services/disk');
let { sandboxDiskResizeService } = await import('../src/services/diskResize');
let { sandboxRegionService } = await import('../src/services/region');
let { sandboxTenantService } = await import('../src/services/tenant');

let region = { oid: 1n, id: 'aws:us-east-1', identifier: 'us-east-1' };
let tenant = {
  oid: 100n,
  id: 'sbt_1',
  organizationOid: 5n,
  projectOid: 6n,
  region
} as any;
let instance = { oid: 7n, id: 'ins_1' } as any;

let disk = { oid: 20n, id: 'sbd_1', type: 'standard', status: 'active', tenant } as any;
let deleted = { ...disk, status: 'deleted' } as any;

let page = (items: any[], pagination: Record<string, unknown> = {}) => ({
  items,
  pagination: { hasMoreAfter: false, hasMoreBefore: false, ...pagination }
});

beforeEach(() => {
  vi.resetAllMocks();

  (sandboxRegionService.getByIdentifier as any).mockResolvedValue(region);
  (sandboxTenantService.ensure as any).mockResolvedValue(tenant);
  db.sandboxDisk.create.mockImplementation(async (a: any) => ({
    oid: 20n,
    type: 'standard',
    ...a.data,
    tenant
  }));
  genesis.disk.delete.mockResolvedValue({
    id: 'sbd_1',
    status: 'deleting',
    sizeBytes: '1073741824'
  });
});

describe('sandboxDiskService.create', () => {
  it('creates the disk in the region and records it for the instance', async () => {
    genesis.disk.create.mockResolvedValue({
      id: 'sbd_new',
      status: 'active',
      name: 'data',
      sizeBytes: '1073741824'
    });

    let result = await sandboxDiskService.create({
      instance,
      regionIdentifier: 'us-east-1',
      input: { name: 'data', sizeBytes: '1073741824', idempotencyKey: 'k' }
    });

    expect(genesis.disk.create).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      name: 'data',
      sizeBytes: '1073741824',
      idempotencyKey: 'k'
    });
    expect(db.sandboxDisk.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          id: 'sbd_new',
          metadata: {},
          name: 'data',
          sizeBytes: 1073741824n,
          tenantOid: 100n,
          organizationOid: 5n,
          projectOid: 6n,
          instanceOid: 7n
        }
      })
    );
    expect(result.remote).toMatchObject({ id: 'sbd_new', status: 'active' });
    expect(result.type).toBe('standard');
    expect(indexDisk).toHaveBeenCalledWith({ diskOid: '20' });
  });

  it('deletes the Genesis disk when it cannot be recorded', async () => {
    genesis.disk.create.mockResolvedValue({ id: 'sbd_new', name: null, sizeBytes: '1' });
    db.sandboxDisk.create.mockRejectedValue(new Error('db down'));

    await expect(
      sandboxDiskService.create({ instance, regionIdentifier: 'us-east-1', input: {} })
    ).rejects.toThrow('db down');

    expect(genesis.disk.delete).toHaveBeenCalledWith({ tenantId: 'sbt_1', diskId: 'sbd_new' });
  });
});

describe('sandboxDiskService.clone', () => {
  it('clones inside the source disk tenant', async () => {
    genesis.disk.clone.mockResolvedValue({ id: 'sbd_copy', name: 'copy', sizeBytes: '1' });

    let result = await sandboxDiskService.clone({
      instance,
      disk,
      input: { name: 'copy' }
    });

    expect(genesis.disk.clone).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      diskId: 'sbd_1',
      name: 'copy'
    });
    expect(result.id).toBe('sbd_copy');
    expect(indexDisk).toHaveBeenCalledWith({ diskOid: '20' });
  });

  it('refuses to clone a deleted disk', async () => {
    await expect(
      sandboxDiskService.clone({ instance, disk: deleted, input: {} })
    ).rejects.toThrow();
    expect(genesis.disk.clone).not.toHaveBeenCalled();
  });
});

describe('sandboxDiskService.get and list', () => {
  it('resolves attached machine labels once per tenant for the whole page', async () => {
    db.sandboxDisk.findMany.mockResolvedValue([disk, { ...disk, oid: 21n, id: 'sbd_2' }]);
    genesis.disk.getMany.mockResolvedValue([
      { id: 'sbd_1', machine: { machineId: 'sbm_1', mountPath: '/data' } },
      { id: 'sbd_2', machine: { machineId: 'sbm_1', mountPath: '/other' } }
    ]);
    genesis.machine.getMany.mockResolvedValue([
      { id: 'sbm_1', name: 'Worker', slug: 'worker' }
    ]);

    let list = await sandboxDiskService.list({ instance }).run({});

    expect(genesis.machine.getMany).toHaveBeenCalledTimes(1);
    expect(genesis.machine.getMany).toHaveBeenCalledWith({
      tenantId: tenant.id,
      ids: ['sbm_1']
    });
    expect(list.items.map(item => item.attachedMachine?.name)).toEqual(['Worker', 'Worker']);
  });

  it('returns a deleted disk from get, without a remote once Genesis dropped it', async () => {
    db.sandboxDisk.findFirst.mockResolvedValue(deleted);
    genesis.disk.getMany.mockResolvedValue([]);

    let result = await sandboxDiskService.get({ instance, diskId: 'sbd_1' });

    expect(db.sandboxDisk.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sbd_1', instanceOid: 7n } })
    );
    expect(result.status).toBe('deleted');
    expect(result.remote).toBeNull();
  });

  it('throws not found for a disk of another instance', async () => {
    db.sandboxDisk.findFirst.mockResolvedValue(null);

    await expect(sandboxDiskService.get({ instance, diskId: 'nope' })).rejects.toThrow();
  });

  it('lists the instance disks of all types and regions from the local table', async () => {
    let root = { ...disk, oid: 21n, id: 'sbd_root1', type: 'root_fs', machineOid: 3n } as any;
    db.sandboxDisk.findMany.mockResolvedValue([{ ...disk, type: 'standard' }, root]);
    genesis.disk.getMany.mockResolvedValue([{ id: 'sbd_1' }, { id: 'sbd_root1' }]);

    let list = await sandboxDiskService.list({ instance }).run({});

    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instanceOid: 7n, status: 'active' } })
    );
    expect(db.sandboxMachine.findMany).not.toHaveBeenCalled();
    expect(list.items.map(item => [item.id, item.type, item.remote?.id])).toEqual([
      ['sbd_1', 'standard', 'sbd_1'],
      ['sbd_root1', 'root_fs', 'sbd_root1']
    ]);
  });

  it('filters the list by an array of types', async () => {
    db.sandboxDisk.findMany.mockResolvedValue([]);

    await sandboxDiskService.list({ instance, types: ['root_fs'] }).run({});

    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instanceOid: 7n, status: 'active', type: { in: ['root_fs'] } }
      })
    );
  });

  it('filters the list to the disks of the given machines', async () => {
    db.sandboxMachine.findMany.mockResolvedValue([{ oid: 3n, id: 'sbm_1', tenant }]);
    genesis.machine.getMany.mockResolvedValue([
      {
        id: 'sbm_1',
        rootFs: { current: { diskId: 'sbd_root1' }, desired: { diskId: 'sbd_root2' } },
        disks: [
          { diskId: 'sbd_1', state: 'mounted' },
          { diskId: 'sbd_old', state: 'released' }
        ]
      }
    ]);
    db.sandboxDisk.findMany.mockResolvedValue([]);

    await sandboxDiskService.list({ instance, machineIds: ['sbm_1'] }).run({});

    expect(db.sandboxMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['sbm_1'] }, instanceOid: 7n } })
    );
    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instanceOid: 7n,
          status: 'active',
          id: { in: ['sbd_root1', 'sbd_root2', 'sbd_1'] }
        }
      })
    );
  });

  it('searches the name and id of the disks, ignoring case and surrounding spaces', async () => {
    db.sandboxDisk.findMany.mockResolvedValue([]);

    await sandboxDiskService.list({ instance, search: '  Data ' }).run({});

    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instanceOid: 7n,
          status: 'active',
          OR: [
            { name: { contains: 'Data', mode: 'insensitive' } },
            { id: { contains: 'Data', mode: 'insensitive' } }
          ]
        }
      })
    );
  });

  it('searches Voyager and intersects results with the other disk filters', async () => {
    search.isSearchEnabled.mockReturnValue(true);
    search.searchSandboxDiskIds.mockResolvedValue(['sbd_1', 'sbd_2']);
    db.sandboxDisk.findMany.mockResolvedValue([]);
    db.sandboxMachine.findMany.mockResolvedValue([{ id: 'sbm_1', tenant }]);
    genesis.machine.getMany.mockResolvedValue([
      {
        id: 'sbm_1',
        rootFs: { current: null, desired: null },
        disks: [{ diskId: 'sbd_1', state: 'mounted' }]
      }
    ]);

    await sandboxDiskService
      .list({
        instance,
        search: '  Data ',
        diskIds: ['sbd_1', 'sbd_other'],
        machineIds: ['sbm_1'],
        attached: true
      })
      .run({});

    expect(search.searchSandboxDiskIds).toHaveBeenCalledWith({
      instanceId: 'ins_1',
      query: 'Data'
    });
    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instanceOid: 7n, status: 'active', id: { in: ['sbd_1'] } }
      })
    );
  });

  it('returns no matches when Voyager finds no disks', async () => {
    search.isSearchEnabled.mockReturnValue(true);
    search.searchSandboxDiskIds.mockResolvedValue([]);
    db.sandboxDisk.findMany.mockResolvedValue([]);

    await sandboxDiskService.list({ instance, search: 'missing' }).run({});

    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instanceOid: 7n, status: 'active', id: { in: [] } }
      })
    );
  });

  it('ignores a search of only spaces', async () => {
    db.sandboxDisk.findMany.mockResolvedValue([]);

    await sandboxDiskService.list({ instance, search: '   ' }).run({});

    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instanceOid: 7n, status: 'active' } })
    );
  });

  it('filters the list by the regions the disks live in', async () => {
    db.sandboxDisk.findMany.mockResolvedValue([]);

    await sandboxDiskService
      .list({ instance, regionIdentifiers: ['us-east-1', 'eu-west-1'] })
      .run({});

    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instanceOid: 7n,
          status: 'active',
          tenant: { region: { identifier: { in: ['us-east-1', 'eu-west-1'] } } }
        }
      })
    );
  });

  describe('attached filter', () => {
    let activeMachines = () => {
      db.sandboxMachine.findMany.mockResolvedValue([
        { oid: 3n, id: 'sbm_1', tenant },
        { oid: 4n, id: 'sbm_2', tenant }
      ]);
      genesis.machine.getMany.mockResolvedValue([
        {
          id: 'sbm_1',
          rootFs: { current: { diskId: 'sbd_root1' }, desired: null },
          disks: [
            { diskId: 'sbd_1', state: 'mounted' },
            { diskId: 'sbd_old', state: 'released' }
          ]
        },
        {
          id: 'sbm_2',
          rootFs: { current: { diskId: 'sbd_root2' }, desired: { diskId: 'sbd_root3' } },
          disks: []
        }
      ]);
      db.sandboxDisk.findMany.mockResolvedValue([]);
    };

    it('lists only the disks an active machine uses', async () => {
      activeMachines();

      await sandboxDiskService.list({ instance, attached: true }).run({});

      expect(db.sandboxMachine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { instanceOid: 7n, status: 'active' },
          orderBy: { oid: 'asc' },
          take: 500
        })
      );
      expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            instanceOid: 7n,
            status: 'active',
            id: { in: ['sbd_root1', 'sbd_1', 'sbd_root2', 'sbd_root3'] }
          }
        })
      );
    });

    it('lists only the disks no active machine uses', async () => {
      activeMachines();

      await sandboxDiskService.list({ instance, attached: false }).run({});

      expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            instanceOid: 7n,
            status: 'active',
            id: { notIn: ['sbd_root1', 'sbd_1', 'sbd_root2', 'sbd_root3'] }
          }
        })
      );
    });

    it('does not look at the machines when the attachment is not filtered', async () => {
      db.sandboxDisk.findMany.mockResolvedValue([]);

      await sandboxDiskService.list({ instance }).run({});

      expect(db.sandboxMachine.findMany).not.toHaveBeenCalled();
    });

    it('narrows the disks of the given machines to the ones that are attached', async () => {
      db.sandboxMachine.findMany.mockResolvedValue([{ oid: 3n, id: 'sbm_1', tenant }]);
      genesis.machine.getMany.mockResolvedValue([
        {
          id: 'sbm_1',
          rootFs: { current: { diskId: 'sbd_root1' }, desired: null },
          disks: [{ diskId: 'sbd_1', state: 'mounted' }]
        }
      ]);
      db.sandboxDisk.findMany.mockResolvedValue([]);

      await sandboxDiskService
        .list({ instance, machineIds: ['sbm_1'], attached: true })
        .run({});

      expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            instanceOid: 7n,
            status: 'active',
            id: { in: ['sbd_root1', 'sbd_1'] }
          }
        })
      );
    });

    it('reads the machines page by page', async () => {
      let machine = (oid: bigint) => ({ oid, id: `sbm_${oid}`, tenant });
      let firstPage = Array.from({ length: 500 }, (_, index) => machine(BigInt(index + 1)));

      db.sandboxMachine.findMany
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce([machine(501n)]);
      genesis.machine.getMany.mockImplementation(async ({ ids }: { ids: string[] }) =>
        ids.map(id => ({
          id,
          rootFs: { current: { diskId: `disk_of_${id}` }, desired: null },
          disks: []
        }))
      );
      db.sandboxDisk.findMany.mockResolvedValue([]);

      await sandboxDiskService.list({ instance, attached: true }).run({});

      expect(db.sandboxMachine.findMany).toHaveBeenCalledTimes(2);
      expect(db.sandboxMachine.findMany.mock.calls[1]![0].where).toEqual({
        instanceOid: 7n,
        status: 'active',
        oid: { gt: 500n }
      });
      expect(db.sandboxDisk.findMany.mock.calls[0]![0].where.id.in).toHaveLength(501);
    });
  });

  it('returns a root filesystem disk from get with its machine link', async () => {
    db.sandboxDisk.findFirst.mockResolvedValue({
      ...disk,
      id: 'sbd_root1',
      type: 'root_fs',
      machineOid: 3n
    });
    genesis.disk.getMany.mockResolvedValue([]);

    let result = await sandboxDiskService.get({ instance, diskId: 'sbd_root1' });

    expect(result).toMatchObject({ id: 'sbd_root1', type: 'root_fs', machineOid: 3n });
    expect(result.remote).toBeNull();
  });
});

describe('sandboxDiskService.update', () => {
  it('renames the disk in the local table and returns it with its remote', async () => {
    db.sandboxDisk.update.mockResolvedValue({ ...disk, name: 'renamed', tenant });
    genesis.disk.getMany.mockResolvedValue([{ id: 'sbd_1', status: 'active' }]);

    let result = await sandboxDiskService.update({ disk, input: { name: 'renamed' } });

    expect(db.sandboxDisk.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 20n }, data: { name: 'renamed' } })
    );
    expect(genesis.disk.getMany).toHaveBeenCalledWith({ tenantId: 'sbt_1', ids: ['sbd_1'] });
    expect(indexDisk).toHaveBeenCalledWith({ diskOid: '20' });
    expect(result.name).toBe('renamed');
    expect(result.remote).toEqual({ id: 'sbd_1', status: 'active' });
  });

  it('clears the name when given null', async () => {
    db.sandboxDisk.update.mockResolvedValue({ ...disk, name: null, tenant });
    genesis.disk.getMany.mockResolvedValue([]);

    await sandboxDiskService.update({ disk, input: { name: null } });

    expect(db.sandboxDisk.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: null } })
    );
  });

  it('refuses root filesystem disks and deleted disks', async () => {
    await expect(
      sandboxDiskService.update({
        disk: { ...disk, type: 'root_fs' } as any,
        input: { name: 'x' }
      })
    ).rejects.toThrow();
    await expect(
      sandboxDiskService.update({ disk: deleted, input: { name: 'x' } })
    ).rejects.toThrow();

    expect(db.sandboxDisk.update).not.toHaveBeenCalled();
  });
});

describe('sandboxDiskService actions', () => {
  it('refuses clone, delete and mounts for root filesystem disks', async () => {
    let root = { ...disk, type: 'root_fs' } as any;

    await expect(
      sandboxDiskService.clone({ instance, disk: root, input: {} })
    ).rejects.toThrow();
    await expect(sandboxDiskService.delete({ disk: root })).rejects.toThrow();
    expect(() => sandboxDiskService.mounts({ disk: root })).toThrow();
    expect(genesis.disk.clone).not.toHaveBeenCalled();
    expect(genesis.disk.delete).not.toHaveBeenCalled();
  });

  it('deletes in Genesis and then marks the disk deleted', async () => {
    db.sandboxDisk.update.mockResolvedValue({ ...deleted, tenant });

    let result = await sandboxDiskService.delete({ disk });

    expect(genesis.disk.delete).toHaveBeenCalledWith({ tenantId: 'sbt_1', diskId: 'sbd_1' });
    expect(db.sandboxDisk.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 20n },
        data: { status: 'deleted', deletedAt: expect.any(Date), sizeBytes: 1073741824n }
      })
    );
    expect(indexDisk).toHaveBeenCalledWith({ diskOid: '20' });
    expect(result.remote).toMatchObject({ id: 'sbd_1', status: 'deleting' });
  });

  it('leaves the disk alone when Genesis refuses the delete', async () => {
    genesis.disk.delete.mockRejectedValue(new Error('attached'));

    await expect(sandboxDiskService.delete({ disk })).rejects.toThrow('attached');
    expect(db.sandboxDisk.update).not.toHaveBeenCalled();
  });

  it('pages the mounts of a disk', async () => {
    genesis.disk.mounts.mockResolvedValue(page([{ id: 'm1' }]));

    let list = await sandboxDiskService.mounts({ disk }).run({});

    expect(list.items).toEqual([{ id: 'm1' }]);
    expect(genesis.disk.mounts).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'sbt_1', diskId: 'sbd_1', order: 'desc' })
    );
  });
});

describe('sandboxDiskResizeService', () => {
  it('grows a root filesystem disk through the same resize', async () => {
    genesis.disk.resize.mockResolvedValue({ id: 'r1', diskId: 'sbd_root1' });

    await sandboxDiskResizeService.start({
      disk: { ...disk, id: 'sbd_root1', type: 'root_fs' } as any,
      input: { sizeBytes: '2147483648', idempotencyKey: 'k' }
    });

    expect(genesis.disk.resize).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'sbt_1', diskId: 'sbd_root1' })
    );
  });

  it('starts a resize on an active disk', async () => {
    genesis.disk.resize.mockResolvedValue({ id: 'r1', diskId: 'sbd_1' });

    await sandboxDiskResizeService.start({
      disk,
      input: { sizeBytes: '2147483648', idempotencyKey: 'k' }
    });
    await expect(
      sandboxDiskResizeService.start({
        disk: deleted,
        input: { sizeBytes: '1', idempotencyKey: 'k' }
      })
    ).rejects.toThrow();

    expect(genesis.disk.resize).toHaveBeenCalledTimes(1);
    expect(genesis.disk.resize).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      diskId: 'sbd_1',
      sizeBytes: '2147483648',
      idempotencyKey: 'k'
    });
  });

  it('only returns resizes that belong to the disk', async () => {
    genesis.disk.resizeGet.mockResolvedValueOnce({ id: 'r1', diskId: 'sbd_1' });
    genesis.disk.resizeGet.mockResolvedValueOnce({ id: 'r2', diskId: 'sbd_other' });

    expect((await sandboxDiskResizeService.get({ disk, resizeId: 'r1' })).id).toBe('r1');
    await expect(sandboxDiskResizeService.get({ disk, resizeId: 'r2' })).rejects.toThrow();
  });

  it('lists resizes newest first', async () => {
    genesis.disk.resizeList.mockResolvedValue(page([{ id: 'r2' }, { id: 'r1' }]));

    let list = await sandboxDiskResizeService.list({ disk }).run({});

    expect(list.items.map(item => item.id)).toEqual(['r2', 'r1']);
    expect(genesis.disk.resizeList).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'sbt_1', diskId: 'sbd_1', order: 'desc' })
    );
  });

  it('filters resizes by an array of statuses', async () => {
    genesis.disk.resizeList.mockResolvedValue(page([]));

    await sandboxDiskResizeService.list({ disk, statuses: ['failed', 'pending'] }).run({});

    expect(genesis.disk.resizeList).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ['failed', 'pending'] })
    );
  });

  it('retries only a resize of the disk', async () => {
    genesis.disk.resizeRetry.mockResolvedValue({ id: 'r1' });
    genesis.disk.resizeGet.mockResolvedValueOnce({ id: 'r1', diskId: 'sbd_1' });
    genesis.disk.resizeGet.mockResolvedValueOnce({ id: 'r2', diskId: 'sbd_other' });

    await sandboxDiskResizeService.retry({ disk, resizeId: 'r1' });
    await expect(sandboxDiskResizeService.retry({ disk, resizeId: 'r2' })).rejects.toThrow();

    expect(genesis.disk.resizeRetry).toHaveBeenCalledTimes(1);
    expect(genesis.disk.resizeRetry).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      resizeId: 'r1'
    });
  });
});

describe('sandbox disk metadata and IDs', () => {
  it('stores metadata on create without passing it to Genesis', async () => {
    genesis.disk.create.mockResolvedValue({ id: 'sbd_new', name: null, sizeBytes: '1' });

    let result = await sandboxDiskService.create({
      instance,
      regionIdentifier: 'us-east-1',
      input: { metadata: { app: 'test' } }
    });

    expect(result.metadata).toEqual({ app: 'test' });
    expect(genesis.disk.create.mock.calls[0]![0]).not.toHaveProperty('metadata');
  });

  it.each([{ type: 'standard' }, { type: 'root_fs' }])(
    'updates metadata on a $type disk',
    async ({ type }) => {
      db.sandboxDisk.update.mockImplementation(async ({ data }) => ({
        ...disk,
        ...data,
        type
      }));
      genesis.disk.getMany.mockResolvedValue([]);

      let result = await sandboxDiskService.update({
        disk: { ...disk, type },
        input: { metadata: {} }
      });

      expect(result.metadata).toEqual({});
      expect(indexDisk).toHaveBeenCalledTimes(type == 'standard' ? 1 : 0);
      expect(db.sandboxDisk.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: undefined, metadata: {} } })
      );
    }
  );

  it('intersects IDs with machine and attached filters', async () => {
    db.sandboxDisk.findMany.mockResolvedValue([]);
    db.sandboxMachine.findMany.mockResolvedValue([{ id: 'sbm_1', tenant }]);
    genesis.machine.getMany.mockResolvedValue([
      {
        id: 'sbm_1',
        rootFs: { current: null, desired: null },
        disks: [{ diskId: 'sbd_1', state: 'mounted' }]
      }
    ]);

    await sandboxDiskService
      .list({
        instance,
        diskIds: ['sbd_1', 'sbd_other'],
        machineIds: ['sbm_1'],
        attached: true
      })
      .run({});

    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['sbd_1'] } }) })
    );
  });

  it('keeps an empty ID filter', async () => {
    db.sandboxDisk.findMany.mockResolvedValue([]);

    await sandboxDiskService.list({ instance, diskIds: [] }).run({});

    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [] } }) })
    );
  });
});
