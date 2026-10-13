import { beforeEach, describe, expect, it, vi } from 'vitest';

let makeClient = () => ({
  machineImage: {
    create: vi.fn(),
    version: { get: vi.fn() },
    build: {
      create: vi.fn(),
      get: vi.fn(),
      cancel: vi.fn(async () => ({})),
      exportArtifact: vi.fn(),
      createFromArtifact: vi.fn(),
      refreshSource: vi.fn()
    }
  }
});

let clients: Record<string, ReturnType<typeof makeClient>> = {
  'aws:eu-west-1': makeClient(),
  'aws:us-east-1': makeClient()
};

let env = { service: { METORIAL_REGION: undefined as string | undefined } };

let queues: Record<string, { add: any; addManyWithOps: any }> = {};
let processors: Record<string, (data: any) => Promise<void>> = {};

let db = {
  sandboxRegion: { findMany: vi.fn() },
  sandboxMachineImageBuild: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn()
  },
  sandboxMachineImageBuildRegion: {
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn()
  },
  sandboxMachineImageVersion: { create: vi.fn(), updateMany: vi.fn() },
  sandboxMachineImageRegion: { upsert: vi.fn() },
  sandboxMachineImageVersionRegion: { upsert: vi.fn() }
};

let refreshAvailability = vi.fn();
let ensureTenant = vi.fn();

vi.mock('../src/env', () => ({ env }));
vi.mock('../src/lib/regions', () => ({
  getRegionClient: vi.fn((id: string) => clients[id]),
  isSandboxingEnabled: vi.fn(() => true)
}));
vi.mock('../src/internal/imageInternal', () => ({
  sandboxImageInternalService: { refreshAvailability }
}));
vi.mock('../src/services/tenant', () => ({ sandboxTenantService: { ensure: ensureTenant } }));
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((list: any[]) => list),
  createQueue: vi.fn((opts: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: (fn: (data: any) => Promise<void>) => {
        processors[opts.name] = fn;
        return fn;
      }
    };
    queues[opts.name] = queue;

    return queue;
  })
}));
vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_new`) },
  withTransaction: vi.fn(async (fn: any) => fn(db)),
  addAfterTransactionHook: vi.fn((fn: any) => fn())
}));

await import('../src/queues/imageBuild');
let { sandboxImageBuildService } = await import('../src/services/imageBuild');

let root = () => processors['sbx/image/build/root']!;
let regionJob = () => processors['sbx/image/build/region']!;

let eu = { oid: 1n, id: 'aws:eu-west-1', identifier: 'dub1' };
let us = { oid: 2n, id: 'aws:us-east-1', identifier: 'iad1' };
let instance = { oid: 7n, organizationOid: 8n, projectOid: 9n } as any;

let row = (r: any, overrides: any = {}) => ({
  oid: BigInt(r.oid) + 100n,
  kind: 'replica',
  status: 'pending',
  attempt: 0,
  nextAttemptAt: null,
  genesisImageId: null,
  genesisBuildId: null,
  logStreamId: null,
  failureCode: null,
  failureMessage: null,
  buildOid: 50n,
  regionOid: r.oid,
  tenantOid: BigInt(r.oid) + 200n,
  region: r,
  tenant: { id: `tenant_${r.identifier}`, oid: BigInt(r.oid) + 200n },
  ...overrides
});

let builderRow = (overrides: any = {}) =>
  row(us, {
    kind: 'builder',
    status: 'building',
    attempt: 1,
    genesisImageId: 'gimg_us',
    genesisBuildId: 'gbuild_us',
    ...overrides
  });

let build = (regions: any[], overrides: any = {}) => ({
  oid: 50n,
  id: 'sbb_1',
  status: 'building',
  builtAt: null,
  diskSizeBytes: 16n * 1024n ** 3n,
  imageOid: 60n,
  versionOid: 70n,
  image: { id: 'sbi_1', name: 'app' },
  regions,
  ...overrides
});

let remoteBuild = (overrides: any = {}) => ({
  id: 'gbuild',
  status: 'copying',
  logStreamId: 'ls_1',
  versionId: null,
  failure: null,
  ...overrides
});

let exported = {
  rootfs: { url: 'https://s/r', bytes: 10, sha256: 'a'.repeat(64) },
  oci: { url: 'https://s/o' },
  rootfsBytes: 20,
  diskSizeBytes: 16 * 1024 ** 3,
  expiresAt: 1234
};

describe('image build root job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (let queue of Object.values(queues)) {
      queue.add.mockReset();
      queue.addManyWithOps.mockReset();
    }
    clients['aws:eu-west-1'] = makeClient();
    clients['aws:us-east-1'] = makeClient();
  });

  it('mirrors the build region while it builds and only polls that region', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(
      build([builderRow({ status: 'queued' }), row(eu)])
    );

    await root()({ buildOid: '50' });

    expect(db.sandboxMachineImageBuild.updateMany).toHaveBeenCalledWith({
      where: { oid: 50n, status: 'building' },
      data: { status: 'queued', builtAt: null }
    });
    let jobs = queues['sbx/image/build/region']!.addManyWithOps.mock.calls[0]![0];
    expect(jobs.map((job: any) => job.data.buildRegionOid)).toEqual(['102']);
    expect(queues['sbx/image/build/root']!.add).toHaveBeenCalledWith(
      { buildOid: '50' },
      expect.objectContaining({ delay: 5000 })
    );
  });

  it('starts replication once the builder has produced the artifact', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(
      build([builderRow({ status: 'processing' }), row(eu)])
    );

    await root()({ buildOid: '50' });

    let jobs = queues['sbx/image/build/region']!.addManyWithOps.mock.calls[0]![0];
    expect(jobs.map((job: any) => job.data.buildRegionOid).sort()).toEqual(['101', '102']);
    expect(db.sandboxMachineImageBuild.updateMany).toHaveBeenCalledWith({
      where: { oid: 50n, status: 'building' },
      data: { status: 'processing', builtAt: expect.any(Date) }
    });
  });

  it('is replicating once the build region is done and other regions are not', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(
      build(
        [
          builderRow({ status: 'succeeded' }),
          row(eu, { status: 'processing' }),
          row({ oid: 3, identifier: 'x' }, { status: 'succeeded' })
        ],
        { status: 'processing', builtAt: new Date() }
      )
    );

    await root()({ buildOid: '50' });

    expect(db.sandboxMachineImageBuild.updateMany).toHaveBeenCalledWith({
      where: { oid: 50n, status: 'processing' },
      data: { status: 'replicating', builtAt: expect.any(Date) }
    });
    expect(queues['sbx/image/build/root']!.add).toHaveBeenCalled();
  });

  it('succeeds once every region is done and refreshes availability', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(
      build([builderRow({ status: 'succeeded' }), row(eu, { status: 'succeeded' })], {
        status: 'replicating'
      })
    );

    await root()({ buildOid: '50' });

    expect(db.sandboxMachineImageBuild.updateMany).toHaveBeenCalledWith({
      where: {
        oid: 50n,
        status: { notIn: ['succeeded', 'failed', 'cancelled', 'timed_out'] }
      },
      data: expect.objectContaining({ status: 'succeeded', failureCode: null })
    });
    expect(db.sandboxMachineImageVersion.updateMany).not.toHaveBeenCalled();
    expect(refreshAvailability).toHaveBeenCalled();
    expect(queues['sbx/image/build/root']!.add).not.toHaveBeenCalled();
  });

  it('fails the build when the build region fails, without trying the other regions', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(
      build([
        builderRow({
          status: 'failed',
          failureCode: 'build_failed',
          failureMessage: 'The Docker build failed.'
        }),
        row(eu)
      ])
    );

    await root()({ buildOid: '50' });

    expect(db.sandboxMachineImageBuild.updateMany).toHaveBeenCalledWith({
      where: {
        oid: 50n,
        status: { notIn: ['succeeded', 'failed', 'cancelled', 'timed_out'] }
      },
      data: expect.objectContaining({
        status: 'failed',
        failureCode: 'build_failed',
        failureMessage: 'The Docker build failed.'
      })
    });
    expect(db.sandboxMachineImageBuildRegion.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [101n] } },
      data: { status: 'cancelled', endedAt: expect.any(Date) }
    });
    expect(db.sandboxMachineImageVersion.updateMany).toHaveBeenCalledWith({
      where: { oid: 70n, status: 'pending' },
      data: { status: 'deleted' }
    });
  });

  it('fails the build when a replica ran out of attempts and cancels what is still running', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(
      build([
        builderRow({ status: 'succeeded' }),
        row(eu, { status: 'failed', failureMessage: 'copy failed' }),
        row(
          { oid: 3, id: 'aws:ap-1', identifier: 'syd1' },
          { status: 'copying', genesisBuildId: 'gbuild_ap' }
        )
      ])
    );
    clients['aws:ap-1'] = makeClient();

    await root()({ buildOid: '50' });

    expect(clients['aws:ap-1']!.machineImage.build.cancel).toHaveBeenCalledWith({
      tenantId: 'tenant_syd1',
      buildId: 'gbuild_ap'
    });
    expect(db.sandboxMachineImageBuild.updateMany).toHaveBeenCalledWith({
      where: expect.anything(),
      data: expect.objectContaining({
        status: 'failed',
        failureCode: 'replication_failed',
        failureMessage: expect.stringContaining('dub1')
      })
    });
  });

  it('ignores a build that has already ended', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(null);

    await root()({ buildOid: '50' });

    expect(queues['sbx/image/build/region']!.addManyWithOps).not.toHaveBeenCalled();
    expect(queues['sbx/image/build/root']!.add).not.toHaveBeenCalled();
  });
});

describe('image build region job', () => {
  let sourceRow = () => builderRow({ status: 'succeeded' });

  let load = (target: any) => {
    db.sandboxMachineImageBuildRegion.findFirst.mockResolvedValue({
      ...target,
      build: build([])
    });
    db.sandboxMachineImageBuildRegion.findFirstOrThrow.mockResolvedValue(sourceRow());
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clients['aws:eu-west-1'] = makeClient();
    clients['aws:us-east-1'] = makeClient();
    clients['aws:us-east-1']!.machineImage.build.exportArtifact.mockResolvedValue(exported);
  });

  it('starts a replica from the build region artifact', async () => {
    let target = row(eu);
    load(target);
    let genesis = clients['aws:eu-west-1']!.machineImage;
    genesis.create.mockResolvedValue({ id: 'gimg_eu' });
    genesis.build.createFromArtifact.mockResolvedValue(remoteBuild({ id: 'gbuild_eu' }));

    await regionJob()({ buildRegionOid: '101' });

    expect(genesis.create).toHaveBeenCalledWith({
      tenantId: 'tenant_dub1',
      name: 'app',
      idempotencyKey: 'sbi_1'
    });
    expect(genesis.build.createFromArtifact).toHaveBeenCalledWith({
      tenantId: 'tenant_dub1',
      imageId: 'gimg_eu',
      source: {
        rootfs: exported.rootfs,
        oci: exported.oci,
        rootfsBytes: 20,
        expiresAt: 1234
      },
      options: { diskSizeBytes: 16 * 1024 ** 3 },
      idempotencyKey: 'sbb_1:1'
    });
    expect(clients['aws:us-east-1']!.machineImage.build.exportArtifact).toHaveBeenCalledWith({
      tenantId: 'tenant_iad1',
      buildId: 'gbuild_us'
    });
    expect(db.sandboxMachineImageBuildRegion.updateMany).toHaveBeenCalledWith({
      where: { oid: target.oid, status: 'pending' },
      data: expect.objectContaining({
        status: 'copying',
        attempt: 1,
        genesisImageId: 'gimg_eu',
        genesisBuildId: 'gbuild_eu'
      })
    });
  });

  it('waits for the retry delay before starting again', async () => {
    load(row(eu, { attempt: 1, nextAttemptAt: new Date(Date.now() + 60_000) }));

    await regionJob()({ buildRegionOid: '101' });

    expect(
      clients['aws:eu-west-1']!.machineImage.build.createFromArtifact
    ).not.toHaveBeenCalled();
    expect(db.sandboxMachineImageBuildRegion.updateMany).not.toHaveBeenCalled();
  });

  it('retries a replica that could not be started, then fails after three attempts', async () => {
    clients['aws:eu-west-1']!.machineImage.create.mockRejectedValue(new Error('boom'));

    load(row(eu, { attempt: 0 }));
    await regionJob()({ buildRegionOid: '101' });

    expect(db.sandboxMachineImageBuildRegion.updateMany).toHaveBeenLastCalledWith({
      where: expect.anything(),
      data: expect.objectContaining({
        status: 'pending',
        attempt: 1,
        nextAttemptAt: expect.any(Date),
        failureCode: 'replica_start_failed'
      })
    });

    load(row(eu, { attempt: 2 }));
    await regionJob()({ buildRegionOid: '101' });

    expect(db.sandboxMachineImageBuildRegion.updateMany).toHaveBeenLastCalledWith({
      where: expect.anything(),
      data: expect.objectContaining({
        status: 'failed',
        attempt: 3,
        endedAt: expect.any(Date)
      })
    });
  });

  it('retries a replica whose regional build failed and fails it after three builds', async () => {
    let genesis = clients['aws:eu-west-1']!.machineImage;
    genesis.build.get.mockResolvedValue(
      remoteBuild({ status: 'failed', failure: { code: 'copy_failed', message: 'nope' } })
    );

    load(row(eu, { status: 'copying', attempt: 1, genesisBuildId: 'gbuild_eu' }));
    await regionJob()({ buildRegionOid: '101' });

    expect(db.sandboxMachineImageBuildRegion.updateMany).toHaveBeenLastCalledWith({
      where: expect.anything(),
      data: expect.objectContaining({
        status: 'pending',
        genesisBuildId: null,
        failureCode: 'copy_failed'
      })
    });

    load(row(eu, { status: 'copying', attempt: 3, genesisBuildId: 'gbuild_eu' }));
    await regionJob()({ buildRegionOid: '101' });

    expect(db.sandboxMachineImageBuildRegion.updateMany).toHaveBeenLastCalledWith({
      where: expect.anything(),
      data: expect.objectContaining({ status: 'failed', failureMessage: 'nope' })
    });
  });

  it('hands a build that lost its source a new signed link', async () => {
    let genesis = clients['aws:eu-west-1']!.machineImage;
    genesis.build.get.mockResolvedValue(
      remoteBuild({ id: 'gbuild_eu', status: 'awaiting_source' })
    );
    load(row(eu, { status: 'copying', attempt: 1, genesisBuildId: 'gbuild_eu' }));

    await regionJob()({ buildRegionOid: '101' });

    expect(genesis.build.refreshSource).toHaveBeenCalledWith({
      tenantId: 'tenant_dub1',
      buildId: 'gbuild_eu',
      source: {
        rootfs: exported.rootfs,
        oci: exported.oci,
        rootfsBytes: 20,
        expiresAt: 1234
      }
    });
  });

  it('mirrors the progress of a regional build', async () => {
    clients['aws:eu-west-1']!.machineImage.build.get.mockResolvedValue(
      remoteBuild({ status: 'processing' })
    );
    load(row(eu, { status: 'copying', attempt: 1, genesisBuildId: 'gbuild_eu' }));

    await regionJob()({ buildRegionOid: '101' });

    expect(db.sandboxMachineImageBuildRegion.updateMany).toHaveBeenCalledWith({
      where: expect.anything(),
      data: { status: 'processing', logStreamId: 'ls_1' }
    });
  });

  it('records the image and version in the region once the regional build succeeded', async () => {
    let genesis = clients['aws:eu-west-1']!.machineImage;
    genesis.build.get.mockResolvedValue(
      remoteBuild({ status: 'succeeded', versionId: 'gver_eu' })
    );
    genesis.version.get.mockResolvedValue({ id: 'gver_eu', digest: 'sha256:abc' });
    db.sandboxMachineImageRegion.upsert.mockResolvedValue({ oid: 900n });
    load(
      row(eu, {
        status: 'processing',
        attempt: 1,
        genesisImageId: 'gimg_eu',
        genesisBuildId: 'gbuild_eu'
      })
    );

    await regionJob()({ buildRegionOid: '101' });

    expect(db.sandboxMachineImageRegion.upsert.mock.calls[0]![0].create).toMatchObject({
      genesisId: 'gimg_eu',
      imageOid: 60n,
      regionOid: 1n
    });
    expect(db.sandboxMachineImageVersionRegion.upsert.mock.calls[0]![0].create).toMatchObject({
      genesisId: 'gver_eu',
      digest: 'sha256:abc',
      versionOid: 70n,
      imageRegionOid: 900n
    });
    expect(db.sandboxMachineImageBuildRegion.updateMany).toHaveBeenLastCalledWith({
      where: expect.anything(),
      data: { status: 'succeeded', endedAt: expect.any(Date) }
    });
  });

  it('ends the build region row without retrying when the builder build failed', async () => {
    clients['aws:us-east-1']!.machineImage.build.get.mockResolvedValue(
      remoteBuild({
        status: 'failed',
        failure: { code: 'build_failed', message: 'bad Dockerfile' }
      })
    );
    load(builderRow());

    await regionJob()({ buildRegionOid: '101' });

    expect(db.sandboxMachineImageBuildRegion.updateMany).toHaveBeenCalledWith({
      where: expect.anything(),
      data: expect.objectContaining({
        status: 'failed',
        failureCode: 'build_failed',
        failureMessage: 'bad Dockerfile'
      })
    });
  });

  it('ignores a region row that already ended', async () => {
    db.sandboxMachineImageBuildRegion.findFirst.mockResolvedValue(null);

    await regionJob()({ buildRegionOid: '101' });

    expect(db.sandboxMachineImageBuildRegion.updateMany).not.toHaveBeenCalled();
  });
});

describe('sandboxImageBuildService', () => {
  let image = {
    oid: 60n,
    id: 'sbi_1',
    name: 'app',
    instanceOid: 7n,
    status: 'pending'
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    env.service.METORIAL_REGION = undefined;
    clients['aws:eu-west-1'] = makeClient();
    clients['aws:us-east-1'] = makeClient();
    db.sandboxRegion.findMany.mockResolvedValue([eu, us]);
    ensureTenant.mockImplementation(async (d: any) => ({
      oid: d.region.oid + 200n,
      id: `tenant_${d.region.identifier}`,
      regionOid: d.region.oid,
      region: d.region
    }));
    for (let client of Object.values(clients)) {
      client.machineImage.create.mockResolvedValue({ id: 'gimg' });
      client.machineImage.build.create.mockResolvedValue({
        id: 'gbuild',
        logStreamId: 'ls',
        options: { diskSizeBytes: 16 * 1024 ** 3 },
        upload: { url: 'u', path: 'p', method: 'PUT', headers: {}, maxBytes: 1, expiresAt: 1 }
      });
    }
    db.sandboxMachineImageVersion.create.mockResolvedValue({ oid: 70n });
    db.sandboxMachineImageBuild.create.mockResolvedValue({
      oid: 50n,
      id: 'sandboxMachineImageBuild_new'
    });
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue({
      id: 'sandboxMachineImageBuild_new'
    });
  });

  it('builds in the region of the Metorial region and prepares a replica for each other region', async () => {
    env.service.METORIAL_REGION = 'us1';

    let result = await sandboxImageBuildService.create({ instance, image, input: {} });

    expect(clients['aws:us-east-1']!.machineImage.build.create).toHaveBeenCalledWith({
      tenantId: 'tenant_iad1',
      imageId: 'gimg',
      options: {},
      idempotencyKey: 'sandboxMachineImageBuild_new'
    });
    expect(clients['aws:eu-west-1']!.machineImage.build.create).not.toHaveBeenCalled();
    expect(result.upload).toMatchObject({ path: 'p' });

    let kinds = db.sandboxMachineImageBuildRegion.create.mock.calls.map((call: any) => [
      call[0].data.regionOid,
      call[0].data.kind,
      call[0].data.status
    ]);
    expect(kinds).toEqual([
      [1n, 'replica', 'pending'],
      [2n, 'builder', 'preparing']
    ]);
    expect(db.sandboxMachineImageVersion.create.mock.calls[0]![0].data.releaseKey).toBe(
      'build:sandboxMachineImageBuild_new'
    );
    expect(queues['sbx/image/build/root']!.add).toHaveBeenCalledWith({ buildOid: '50' });
  });

  it('picks the first region when the Metorial region has no build region', async () => {
    await sandboxImageBuildService.create({ instance, image, input: {} });

    expect(clients['aws:eu-west-1']!.machineImage.build.create).toHaveBeenCalled();
  });

  it('cancels the regional build when the build cannot be recorded', async () => {
    db.sandboxMachineImageBuild.create.mockRejectedValue(new Error('db down'));

    await expect(
      sandboxImageBuildService.create({ instance, image, input: {} })
    ).rejects.toThrow('db down');

    expect(clients['aws:eu-west-1']!.machineImage.build.cancel).toHaveBeenCalledWith({
      tenantId: 'tenant_dub1',
      buildId: 'gbuild'
    });
  });

  it('rejects an image that belongs to another instance', async () => {
    await expect(
      sandboxImageBuildService.create({
        instance,
        image: { ...image, instanceOid: 99n },
        input: {}
      })
    ).rejects.toThrow();
  });

  it('cancels the regional builds and ends the build', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue({
      oid: 50n,
      id: 'sbb_1',
      status: 'replicating',
      versionOid: 70n,
      regions: [
        builderRow({ status: 'succeeded' }),
        row(eu, { status: 'copying', genesisBuildId: 'gbuild_eu' })
      ]
    });

    await sandboxImageBuildService.cancel({ instance, build: { id: 'sbb_1' } });

    expect(clients['aws:eu-west-1']!.machineImage.build.cancel).toHaveBeenCalledWith({
      tenantId: 'tenant_dub1',
      buildId: 'gbuild_eu'
    });
    expect(clients['aws:us-east-1']!.machineImage.build.cancel).not.toHaveBeenCalled();
    expect(db.sandboxMachineImageBuild.updateMany).toHaveBeenCalledWith({
      where: { oid: 50n, status: { in: expect.any(Array) } },
      data: expect.objectContaining({ status: 'cancelled', failureCode: 'cancelled' })
    });
  });
});
