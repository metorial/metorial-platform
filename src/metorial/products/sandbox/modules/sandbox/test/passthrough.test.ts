import { beforeEach, describe, expect, it, vi } from 'vitest';

let genesis = {
  machineImage: { createDisk: vi.fn() },
  disk: { delete: vi.fn() },
  logStream: { lines: vi.fn() },
  machine: {
    access: { createToken: vi.fn(), setPublicPorts: vi.fn() },
    instance: {
      list: vi.fn(),
      get: vi.fn(),
      operation: { list: vi.fn(), get: vi.fn() },
      guestError: { list: vi.fn(), get: vi.fn() }
    },
    event: { list: vi.fn(), get: vi.fn() },
    operation: { list: vi.fn(), get: vi.fn() },
    guestError: { list: vi.fn(), get: vi.fn() },
    usage: vi.fn()
  }
};

let db = {
  sandboxMachineImage: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  sandboxDisk: { create: vi.fn() },
  sandboxMachineImageRegion: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  sandboxMachineImageVersionRegion: { findFirst: vi.fn() },
  sandboxMachineImageBuildRegion: { findMany: vi.fn() },
  sandboxMachineImageBuild: { findMany: vi.fn() },
  sandboxMachineImageVersion: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() }
};

vi.mock('../src/env', () => ({ env: { genesis: {} } }));
vi.mock('../src/lib/regions', () => ({ getRegionClient: vi.fn(() => genesis) }));
vi.mock('../src/queues/imageBuild', () => ({ imageBuildRootQueue: { add: vi.fn() } }));
vi.mock('../src/queues/imageRemote', () => ({ imageRemoteRootQueue: { add: vi.fn() } }));
vi.mock('../src/lib/imageBuildEnd', () => ({
  terminalBuildStatuses: ['succeeded', 'failed', 'cancelled', 'timed_out']
}));
vi.mock('../src/services/region', () => ({
  sandboxRegionService: { getByIdentifier: vi.fn() }
}));
vi.mock('../src/services/spec', () => ({ sandboxSpecService: { resolve: vi.fn() } }));
vi.mock('../src/services/tenant', () => ({ sandboxTenantService: { ensure: vi.fn() } }));
vi.mock('../src/services/imageBuild', () => ({
  sandboxImageBuildService: { cancel: vi.fn(async () => ({})) }
}));
vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_new`) },
  withTransaction: vi.fn(async (callback: any) => callback(db)),
  addAfterTransactionHook: vi.fn((fn: any) => fn())
}));

let { createRemotePaginator } = await import('../src/lib/remotePaginator');
let { sandboxMachineAccessService } = await import('../src/services/machineAccess');
let { sandboxMachineInstanceService } = await import('../src/services/machineInstance');
let { sandboxMachineEventService } = await import('../src/services/machineEvent');
let { sandboxMachineOperationService } = await import('../src/services/machineOperation');
let { sandboxMachineErrorService } = await import('../src/services/machineError');
let { sandboxImageService } = await import('../src/services/image');
let { sandboxTenantService } = await import('../src/services/tenant');
let { sandboxRegionService } = await import('../src/services/region');
let { sandboxMachineService } = await import('../src/services/machine');
let { imageRemoteRootQueue } = await import('../src/queues/imageRemote');
let { sandboxImageVersionService } = await import('../src/services/imageVersion');
let { sandboxImageBuildService } = await import('../src/services/imageBuild');

let region = { oid: 1n, id: 'aws:us-east-1', identifier: 'us-east-1' };
let tenant = { oid: 100n, id: 'sbt_1', slug: 'p', region } as any;
let machine = { oid: 5n, id: 'sbm_1', status: 'active', tenant } as any;
let terminated = { ...machine, status: 'deleted' } as any;
let instance = { oid: 7n } as any;

let page = (items: any[], pagination: Record<string, unknown> = {}) => ({
  items,
  pagination: { hasMoreAfter: false, hasMoreBefore: false, ...pagination }
});

beforeEach(() => vi.resetAllMocks());

describe('createRemotePaginator', () => {
  it('turns a forward page into after/before cursors from the last and first ids', async () => {
    let fetch = vi.fn(async () =>
      page([{ id: 'a' }, { id: 'b' }], { hasMoreAfter: true, hasMoreBefore: true })
    );

    let list = await createRemotePaginator(fetch).run({ limit: 2 });

    expect(fetch).toHaveBeenCalledWith({ limit: 2, order: 'asc', after: undefined });
    expect(list.pagination.hasNextPage).toBe(true);
    expect(list.pagination.hasPreviousPage).toBe(true);
  });

  it('forwards an after cursor back to Genesis as the raw id', async () => {
    let fetch = vi.fn(async () => page([{ id: 'c' }]));

    let first = await createRemotePaginator(async () =>
      page([{ id: 'a' }, { id: 'b' }], { hasMoreAfter: true })
    ).run({ limit: 2 });

    await createRemotePaginator(fetch).run({ limit: 2, after: first.pagination.after });

    expect(fetch).toHaveBeenCalledWith({ limit: 2, order: 'asc', after: 'b' });
  });

  it('prefers the cursor Genesis returned over the item id', async () => {
    let first = await createRemotePaginator(async () =>
      page([{ value: 1 }], { hasMoreAfter: true, after: 'cur_x' })
    ).run({ limit: 1 });

    let fetch = vi.fn(async () => page([]));
    await createRemotePaginator(fetch).run({ limit: 1, after: first.pagination.after });

    expect(fetch).toHaveBeenCalledWith({ limit: 1, order: 'asc', after: 'cur_x' });
  });
});

describe('sandboxMachineAccessService', () => {
  beforeEach(() => genesis.machine.access.createToken.mockResolvedValue({ token: 't' }));

  it('creates shell and files tokens with their scope', async () => {
    await sandboxMachineAccessService.createShellAccess({ machine });
    await sandboxMachineAccessService.createFilesAccess({
      machine,
      input: { ttlSeconds: 60 }
    });

    expect(genesis.machine.access.createToken).toHaveBeenNthCalledWith(1, {
      tenantId: 'sbt_1',
      machineId: 'sbm_1',
      scope: 'shell',
      ports: undefined,
      ttlSeconds: undefined
    });
    expect(genesis.machine.access.createToken).toHaveBeenNthCalledWith(2, {
      tenantId: 'sbt_1',
      machineId: 'sbm_1',
      scope: 'files',
      ports: undefined,
      ttlSeconds: 60
    });
  });

  it('creates port tokens for specific ports or all of them', async () => {
    await sandboxMachineAccessService.createPortAccess({
      machine,
      input: { ports: [3000, 8080] }
    });
    await sandboxMachineAccessService.createPortAccess({ machine, input: { ports: '*' } });

    expect(genesis.machine.access.createToken).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ scope: 'port', ports: [3000, 8080] })
    );
    expect(genesis.machine.access.createToken).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ scope: 'port', ports: '*' })
    );
  });

  it('refuses to hand out access to a terminated machine', async () => {
    await expect(
      sandboxMachineAccessService.createShellAccess({ machine: terminated })
    ).rejects.toThrow();
    expect(genesis.machine.access.createToken).not.toHaveBeenCalled();
  });
});

describe('sandboxMachineInstanceService', () => {
  it('lists and gets instances through the machine scope', async () => {
    genesis.machine.instance.list.mockResolvedValue(page([{ id: 'sbmi_1' }]));
    genesis.machine.instance.get.mockResolvedValue({ id: 'sbmi_1' });

    let list = await sandboxMachineInstanceService.list({ machine }).run({ limit: 5 });
    await sandboxMachineInstanceService.get({ machine, instanceId: 'sbmi_1' });

    expect(list.items).toEqual([{ id: 'sbmi_1' }]);
    expect(genesis.machine.instance.list).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      machineId: 'sbm_1',
      limit: 5,
      order: 'asc',
      after: undefined
    });
    expect(genesis.machine.instance.get).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      machineId: 'sbm_1',
      instanceId: 'sbmi_1'
    });
  });

  it('reads the instance log stream through the log service', async () => {
    genesis.machine.instance.get.mockResolvedValue({ id: 'sbmi_1', logStreamId: 'log_1' });
    genesis.logStream.lines.mockResolvedValue({ lines: [] });

    await sandboxMachineInstanceService.logs({
      machine,
      instanceId: 'sbmi_1',
      input: { direction: 'backward', limit: 50 }
    });

    expect(genesis.logStream.lines).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      logStreamId: 'log_1',
      direction: 'backward',
      limit: 50
    });
  });

  it('reports a missing log stream as not found', async () => {
    genesis.machine.instance.get.mockResolvedValue({ id: 'sbmi_1', logStreamId: null });

    await expect(
      sandboxMachineInstanceService.logs({ machine, instanceId: 'sbmi_1', input: {} })
    ).rejects.toThrow();
    expect(genesis.logStream.lines).not.toHaveBeenCalled();
  });
});

describe('sandboxMachineService.usage', () => {
  it('pages usage for the whole machine, newest first by default', async () => {
    genesis.machine.usage.mockResolvedValue(page([]));

    await sandboxMachineService.usage({ machine }).run({});

    expect(genesis.machine.usage).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      machineId: 'sbm_1',
      instanceIds: undefined,
      limit: 20,
      order: 'desc',
      after: undefined
    });
  });

  it('narrows usage to the given instances', async () => {
    genesis.machine.usage.mockResolvedValue(page([]));

    await sandboxMachineService.usage({ machine, instanceIds: ['a', 'b'] }).run({});

    expect(genesis.machine.usage).toHaveBeenCalledWith(
      expect.objectContaining({ instanceIds: ['a', 'b'] })
    );
  });
});

describe('sandboxMachineEventService', () => {
  it('lists events with scope, instance and order options', async () => {
    genesis.machine.event.list.mockResolvedValue(page([]));

    await sandboxMachineEventService
      .list({ machine, instanceIds: ['sbmi_1'], scope: 'instance', reverse: true })
      .run({});

    expect(genesis.machine.event.list).toHaveBeenCalledWith(
      expect.objectContaining({
        machineId: 'sbm_1',
        instanceIds: ['sbmi_1'],
        scope: 'instance',
        reverse: true
      })
    );
  });

  it('forwards type and source array filters', async () => {
    genesis.machine.event.list.mockResolvedValue(page([]));

    await sandboxMachineEventService
      .list({ machine, types: ['running', 'failed'], sources: ['guest'] })
      .run({});

    expect(genesis.machine.event.list).toHaveBeenCalledWith(
      expect.objectContaining({ types: ['running', 'failed'], sources: ['guest'] })
    );
  });

  it('gets one event', async () => {
    await sandboxMachineEventService.get({ machine, eventId: 'sbme_1' });

    expect(genesis.machine.event.get).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      machineId: 'sbm_1',
      eventId: 'sbme_1'
    });
  });
});

describe.each([
  {
    name: 'sandboxMachineOperationService',
    service: sandboxMachineOperationService,
    key: 'operation' as const,
    idField: 'operationId'
  },
  {
    name: 'sandboxMachineErrorService',
    service: sandboxMachineErrorService,
    key: 'guestError' as const,
    idField: 'errorId'
  }
])('$name', ({ service, key, idField }) => {
  it('lists at machine level without an instance', async () => {
    genesis.machine[key].list.mockResolvedValue(page([]));

    await (service as any).list({ machine }).run({});

    expect(genesis.machine[key].list).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'sbt_1', machineId: 'sbm_1' })
    );
    expect(genesis.machine.instance[key].list).not.toHaveBeenCalled();
  });

  it('forwards array filters at both levels', async () => {
    if (key != 'operation') return;

    genesis.machine.operation.list.mockResolvedValue(page([]));
    genesis.machine.instance.operation.list.mockResolvedValue(page([]));

    await (service as any)
      .list({ machine, kinds: ['start'], triggers: ['api'], outcomes: ['failed'] })
      .run({});
    await (service as any)
      .list({ machine, instanceId: 'sbmi_1', kinds: ['pause'], outcomes: ['active'] })
      .run({});

    expect(genesis.machine.operation.list).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['start'], triggers: ['api'], outcomes: ['failed'] })
    );
    expect(genesis.machine.instance.operation.list).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['pause'], outcomes: ['active'] })
    );
  });

  it('lists at instance level when an instance is given', async () => {
    genesis.machine.instance[key].list.mockResolvedValue(page([]));

    await (service as any).list({ machine, instanceId: 'sbmi_1' }).run({});

    expect(genesis.machine.instance[key].list).toHaveBeenCalledWith(
      expect.objectContaining({ machineId: 'sbm_1', instanceId: 'sbmi_1' })
    );
    expect(genesis.machine[key].list).not.toHaveBeenCalled();
  });

  it('gets at machine and instance level', async () => {
    await (service as any).get({ machine, [idField]: 'x_1' });
    await (service as any).get({ machine, instanceId: 'sbmi_1', [idField]: 'x_2' });

    expect(genesis.machine[key].get).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      machineId: 'sbm_1',
      [idField]: 'x_1'
    });
    expect(genesis.machine.instance[key].get).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      machineId: 'sbm_1',
      instanceId: 'sbmi_1',
      [idField]: 'x_2'
    });
  });
});

describe('sandboxImageService', () => {
  let own = { oid: 10n, id: 'sbi_own', instanceOid: 7n, status: 'active' } as any;
  let global = { oid: 11n, id: 'sbi_global', instanceOid: null, status: 'active' } as any;

  beforeEach(() => {
    db.sandboxMachineImage.findFirst.mockResolvedValue(own);
    db.sandboxMachineImageBuild.findMany.mockResolvedValue([{ id: 'sbib_1' }]);
  });

  describe('createDisk', () => {
    let tenant = {
      oid: 100n,
      id: 'sbt_1',
      organizationOid: 5n,
      projectOid: 6n,
      region
    } as any;

    beforeEach(() => {
      (sandboxRegionService.getByIdentifier as any).mockResolvedValue(region);
      (sandboxTenantService.ensure as any).mockResolvedValue(tenant);
      db.sandboxMachineImageRegion.findFirst.mockResolvedValue({ genesisId: 'gi_1' });
      db.sandboxMachineImageVersionRegion.findFirst.mockResolvedValue({ genesisId: 'gv_1' });
      db.sandboxDisk.create.mockImplementation(async (a: any) => ({ ...a.data, tenant }));
      genesis.machineImage.createDisk.mockResolvedValue({ id: 'sbd_new' });
    });

    it('creates a disk from the regional image and version and records it', async () => {
      let result = await sandboxImageService.createDisk({
        instance,
        image: global,
        regionIdentifier: 'us-east-1',
        input: { versionId: 'sbiv_1', name: 'seed', idempotencyKey: 'k' }
      });

      expect(genesis.machineImage.createDisk).toHaveBeenCalledWith({
        tenantId: 'sbt_1',
        imageId: 'gi_1',
        versionId: 'gv_1',
        name: 'seed',
        idempotencyKey: 'k'
      });
      expect(db.sandboxDisk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: 'sbd_new', instanceOid: 7n })
        })
      );
      expect(result.remote).toEqual({ id: 'sbd_new' });
    });

    it('uses the current version when none is given', async () => {
      await sandboxImageService.createDisk({
        instance,
        image: own,
        regionIdentifier: 'us-east-1',
        input: {}
      });

      expect(genesis.machineImage.createDisk).toHaveBeenCalledWith(
        expect.objectContaining({ versionId: undefined })
      );
    });

    it('rejects an image missing in the region, an unknown version and other instances images', async () => {
      db.sandboxMachineImageRegion.findFirst.mockResolvedValueOnce(null);
      await expect(
        sandboxImageService.createDisk({
          instance,
          image: own,
          regionIdentifier: 'us-east-1',
          input: {}
        })
      ).rejects.toThrow(/not available/);

      db.sandboxMachineImageVersionRegion.findFirst.mockResolvedValueOnce(null);
      await expect(
        sandboxImageService.createDisk({
          instance,
          image: own,
          regionIdentifier: 'us-east-1',
          input: { versionId: 'sbiv_x' }
        })
      ).rejects.toThrow();

      await expect(
        sandboxImageService.createDisk({
          instance,
          image: { ...own, instanceOid: 99n },
          regionIdentifier: 'us-east-1',
          input: {}
        })
      ).rejects.toThrow();

      expect(genesis.machineImage.createDisk).not.toHaveBeenCalled();
    });
  });

  it('hides deleted images from lists by default but returns them from get', async () => {
    db.sandboxMachineImage.findMany.mockResolvedValue([]);

    await (await sandboxImageService.list({ instance })).run({});
    await sandboxImageService.get({ instance, imageId: 'sbi_own' });

    let listWhere = db.sandboxMachineImage.findMany.mock.calls[0]![0].where;
    let serialized = JSON.stringify(listWhere, (_, value) =>
      typeof value == 'bigint' ? value.toString() : value
    );
    expect(serialized).not.toContain('deleted');
    expect(serialized).toContain('"status"');
    expect(db.sandboxMachineImage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sbi_own', OR: [{ instanceOid: null }, { instanceOid: 7n }] }
      })
    );
  });

  it('filters the list by owner and search', async () => {
    db.sandboxMachineImage.findMany.mockResolvedValue([]);

    await (await sandboxImageService.list({ instance, owner: 'own', search: 'node' })).run({});

    expect(db.sandboxMachineImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { OR: [{ instanceOid: 7n, status: { in: ['active', 'pending'] } }] },
            {
              OR: [
                { name: { contains: 'node', mode: 'insensitive' } },
                { identifier: { contains: 'node', mode: 'insensitive' } }
              ]
            }
          ]
        }
      })
    );
  });

  it('lists global and own images by default', async () => {
    db.sandboxMachineImage.findMany.mockResolvedValue([]);

    await (await sandboxImageService.list({ instance })).run({});

    let where = db.sandboxMachineImage.findMany.mock.calls[0]![0].where;
    expect(where.AND[0].OR).toHaveLength(2);
    expect(where.AND).toHaveLength(1);
  });

  it('renames the image locally and queues the regional updates', async () => {
    await sandboxImageService.update({ instance, image: own, input: { name: 'new' } });

    expect(db.sandboxMachineImage.update).toHaveBeenCalledWith({
      where: { oid: 10n },
      data: { name: 'new' }
    });
    expect(imageRemoteRootQueue.add).toHaveBeenCalledWith({ imageOid: '10' });
  });

  it('does not queue anything when nothing changes', async () => {
    await sandboxImageService.update({ instance, image: own, input: {} });

    expect(db.sandboxMachineImage.update).not.toHaveBeenCalled();
    expect(imageRemoteRootQueue.add).not.toHaveBeenCalled();
  });

  it('does not touch global images', async () => {
    await expect(
      sandboxImageService.update({ instance, image: global, input: { name: 'x' } })
    ).rejects.toThrow();
    await expect(sandboxImageService.delete({ instance, image: global })).rejects.toThrow();

    expect(imageRemoteRootQueue.add).not.toHaveBeenCalled();
  });

  it('cancels builds, marks the rows deleted and queues the regional deletes', async () => {
    await sandboxImageService.delete({ instance, image: own });

    expect(sandboxImageBuildService.cancel).toHaveBeenCalledWith({
      instance,
      build: { id: 'sbib_1' }
    });
    expect(db.sandboxMachineImageRegion.updateMany).toHaveBeenCalledWith({
      where: { imageOid: 10n },
      data: { status: 'deleted' }
    });
    expect(db.sandboxMachineImage.update).toHaveBeenCalledWith({
      where: { oid: 10n },
      data: { status: 'deleted', deletedAt: expect.any(Date) }
    });
    expect(imageRemoteRootQueue.add).toHaveBeenCalledWith({ imageOid: '10' });
  });
});

describe('sandboxImageVersionService', () => {
  let own = { oid: 10n, instanceOid: 7n } as any;
  let global = { oid: 11n, instanceOid: null } as any;

  it('includes pending versions only for tenant-owned images', async () => {
    db.sandboxMachineImageVersion.findMany.mockResolvedValue([]);

    await (await sandboxImageVersionService.list({ image: own })).run({});
    await (await sandboxImageVersionService.list({ image: global })).run({});

    let [ownCall, globalCall] = db.sandboxMachineImageVersion.findMany.mock.calls;
    expect(ownCall![0].where).toEqual({
      imageOid: 10n,
      status: { in: ['active', 'pending'] }
    });
    expect(globalCall![0].where).toEqual({ imageOid: 11n, status: { in: ['active'] } });
  });

  it('returns a deleted version from get without a status filter', async () => {
    db.sandboxMachineImageVersion.findFirst.mockResolvedValue({ id: 'sbiv_1' });

    await sandboxImageVersionService.get({ image: own, versionId: 'sbiv_1' });

    expect(db.sandboxMachineImageVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sbiv_1', imageOid: 10n } })
    );
  });

  it('throws when the version is not on the image', async () => {
    db.sandboxMachineImageVersion.findFirst.mockResolvedValue(null);

    await expect(
      sandboxImageVersionService.get({ image: own, versionId: 'sbiv_x' })
    ).rejects.toThrow();
  });
});
