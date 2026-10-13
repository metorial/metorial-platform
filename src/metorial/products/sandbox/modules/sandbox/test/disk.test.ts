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
let instance = { oid: 7n } as any;

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
    type: 'standard',
    ...a.data,
    tenant
  }));
  genesis.disk.delete.mockResolvedValue({ id: 'sbd_1', status: 'deleting' });
});

describe('sandboxDiskService.create', () => {
  it('creates the disk in the region and records it for the instance', async () => {
    genesis.disk.create.mockResolvedValue({ id: 'sbd_new', status: 'active' });

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
          tenantOid: 100n,
          organizationOid: 5n,
          projectOid: 6n,
          instanceOid: 7n
        }
      })
    );
    expect(result.remote).toEqual({ id: 'sbd_new', status: 'active' });
    expect(result.type).toBe('standard');
  });

  it('deletes the Genesis disk when it cannot be recorded', async () => {
    genesis.disk.create.mockResolvedValue({ id: 'sbd_new' });
    db.sandboxDisk.create.mockRejectedValue(new Error('db down'));

    await expect(
      sandboxDiskService.create({ instance, regionIdentifier: 'us-east-1', input: {} })
    ).rejects.toThrow('db down');

    expect(genesis.disk.delete).toHaveBeenCalledWith({ tenantId: 'sbt_1', diskId: 'sbd_new' });
  });
});

describe('sandboxDiskService.clone', () => {
  it('clones inside the source disk tenant', async () => {
    genesis.disk.clone.mockResolvedValue({ id: 'sbd_copy' });

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
  });

  it('refuses to clone a deleted disk', async () => {
    await expect(
      sandboxDiskService.clone({ instance, disk: deleted, input: {} })
    ).rejects.toThrow();
    expect(genesis.disk.clone).not.toHaveBeenCalled();
  });
});

describe('sandboxDiskService.get and list', () => {
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
        data: { status: 'deleted', deletedAt: expect.any(Date) }
      })
    );
    expect(result.remote).toEqual({ id: 'sbd_1', status: 'deleting' });
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
