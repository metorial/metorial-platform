import {
  db,
  ID,
  type SandboxMachineImageBuildRegionStatus,
  type SandboxMachineImageBuildStatus
} from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { sandboxImageInternalService } from '../internal/imageInternal';
import { getRegionClient } from '../lib/regions';

let TICK_MS = 5000;
let MAX_REPLICA_ATTEMPTS = 3;
let REPLICA_RETRY_DELAY_MS = 30_000;

let toRegionStatus = (remoteStatus: string) =>
  (remoteStatus == 'awaiting_context'
    ? 'preparing'
    : remoteStatus) as SandboxMachineImageBuildRegionStatus;

let terminalBuildStatuses: SandboxMachineImageBuildStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
  'timed_out'
];

let terminalRegionStatuses: SandboxMachineImageBuildRegionStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
  'timed_out'
];

let failedRegionStatuses: SandboxMachineImageBuildRegionStatus[] = [
  'failed',
  'cancelled',
  'timed_out'
];

let regionInclude = { region: true, tenant: true } as const;

let tickJobId = (prefix: string, oid: bigint) =>
  `${prefix}-${oid}-${Math.floor((Date.now() + TICK_MS) / TICK_MS)}`;

export let imageBuildRootQueue = createQueue<{ buildOid: string }>({
  name: 'sbx/image/build/root',
  workerOpts: { concurrency: 10 }
});

export let imageBuildRootQueueProcessor = imageBuildRootQueue.process(async data => {
  let build = await db.sandboxMachineImageBuild.findFirst({
    where: { oid: BigInt(data.buildOid), status: { notIn: terminalBuildStatuses } },
    include: { regions: { include: regionInclude, orderBy: { oid: 'asc' } } }
  });
  if (!build) return;

  let builder = build.regions.find(row => row.kind == 'builder')!;
  let replicas = build.regions.filter(row => row.kind == 'replica');
  let artifactReady = builder.status == 'processing' || builder.status == 'succeeded';

  await imageBuildRegionQueue.addManyWithOps(
    build.regions
      .filter(row => !terminalRegionStatuses.includes(row.status))
      .filter(row => row.kind == 'builder' || artifactReady)
      .map(row => ({
        data: { buildRegionOid: row.oid.toString() },
        opts: { id: tickJobId('region', row.oid) }
      }))
  );

  let failedReplica = replicas.find(row => row.status == 'failed');
  let status: SandboxMachineImageBuildStatus;
  let failure: { code: string; message: string } | null = null;

  if (failedRegionStatuses.includes(builder.status)) {
    status = builder.status as SandboxMachineImageBuildStatus;
    failure = {
      code: builder.failureCode ?? 'build_failed',
      message: builder.failureMessage ?? 'The build failed.'
    };
  } else if (failedReplica) {
    status = 'failed';
    failure = {
      code: 'replication_failed',
      message:
        `The image could not be replicated to ${failedReplica.region.identifier}. ${failedReplica.failureMessage ?? ''}`.trim()
    };
  } else if (builder.status != 'succeeded') {
    status = builder.status as SandboxMachineImageBuildStatus;
  } else if (replicas.every(row => row.status == 'succeeded')) {
    status = 'succeeded';
  } else {
    status = 'replicating';
  }

  if (!terminalBuildStatuses.includes(status)) {
    if (status != build.status || (artifactReady && !build.builtAt)) {
      await db.sandboxMachineImageBuild.updateMany({
        where: { oid: build.oid, status: build.status },
        data: { status, builtAt: artifactReady ? (build.builtAt ?? new Date()) : null }
      });
    }

    await imageBuildRootQueue.add(
      { buildOid: data.buildOid },
      { id: tickJobId('root', build.oid), delay: TICK_MS }
    );

    return;
  }

  let remaining = build.regions.filter(row => !terminalRegionStatuses.includes(row.status));
  for (let row of remaining) {
    if (!row.genesisBuildId) continue;

    await getRegionClient(row.region.id)
      .machineImage.build.cancel({ tenantId: row.tenant.id, buildId: row.genesisBuildId })
      .catch(() => undefined);
  }

  let now = new Date();

  await db.sandboxMachineImageBuildRegion.updateMany({
    where: { oid: { in: remaining.map(row => row.oid) } },
    data: { status: 'cancelled', endedAt: now }
  });

  await db.sandboxMachineImageBuild.updateMany({
    where: { oid: build.oid, status: { notIn: terminalBuildStatuses } },
    data: {
      status,
      failureCode: failure?.code ?? null,
      failureMessage: failure?.message ?? null,
      endedAt: now
    }
  });

  if (status != 'succeeded') {
    await db.sandboxMachineImageVersion.updateMany({
      where: { oid: build.versionOid, status: 'pending' },
      data: { status: 'deleted' }
    });
  }

  await sandboxImageInternalService.refreshAvailability();
});

export let imageBuildRegionQueue = createQueue<{ buildRegionOid: string }>({
  name: 'sbx/image/build/region',
  workerOpts: { concurrency: 10 }
});

export let imageBuildRegionQueueProcessor = imageBuildRegionQueue.process(async data => {
  let row = await db.sandboxMachineImageBuildRegion.findFirst({
    where: {
      oid: BigInt(data.buildRegionOid),
      status: { notIn: terminalRegionStatuses },
      build: { status: { notIn: terminalBuildStatuses } }
    },
    include: { ...regionInclude, build: { include: { image: true } } }
  });
  if (!row) return;

  let genesis = getRegionClient(row.region.id);

  let exportFromBuilder = async () => {
    let builder = await db.sandboxMachineImageBuildRegion.findFirstOrThrow({
      where: { buildOid: row.buildOid, kind: 'builder' },
      include: regionInclude
    });

    let exported = await getRegionClient(builder.region.id).machineImage.build.exportArtifact({
      tenantId: builder.tenant.id,
      buildId: builder.genesisBuildId!
    });

    return {
      rootfs: exported.rootfs,
      oci: exported.oci,
      rootfsBytes: exported.rootfsBytes,
      expiresAt: exported.expiresAt
    };
  };

  let failAttempt = async (
    failure: { code: string; message: string },
    attemptsUsed: number
  ) => {
    let exhausted = attemptsUsed >= MAX_REPLICA_ATTEMPTS;

    await db.sandboxMachineImageBuildRegion.updateMany({
      where: { oid: row.oid, status: { notIn: terminalRegionStatuses } },
      data: {
        status: exhausted ? 'failed' : 'pending',
        attempt: attemptsUsed,
        genesisBuildId: null,
        nextAttemptAt: exhausted
          ? null
          : new Date(Date.now() + REPLICA_RETRY_DELAY_MS * attemptsUsed),
        failureCode: failure.code,
        failureMessage: failure.message,
        endedAt: exhausted ? new Date() : null
      }
    });
  };

  if (row.status == 'pending') {
    if (row.nextAttemptAt && row.nextAttemptAt.getTime() > Date.now()) return;

    try {
      let imageId =
        row.genesisImageId ??
        (
          await genesis.machineImage.create({
            tenantId: row.tenant.id,
            name: row.build.image.name ?? undefined,
            idempotencyKey: row.build.image.id
          })
        ).id;

      let remote = await genesis.machineImage.build.createFromArtifact({
        tenantId: row.tenant.id,
        imageId,
        source: await exportFromBuilder(),
        options: { diskSizeBytes: Number(row.build.diskSizeBytes) },
        idempotencyKey: `${row.build.id}:${row.attempt + 1}`
      });

      await db.sandboxMachineImageBuildRegion.updateMany({
        where: { oid: row.oid, status: 'pending' },
        data: {
          status: toRegionStatus(remote.status),
          attempt: row.attempt + 1,
          nextAttemptAt: null,
          genesisImageId: imageId,
          genesisBuildId: remote.id,
          logStreamId: remote.logStreamId,
          failureCode: null,
          failureMessage: null
        }
      });
    } catch (err) {
      await failAttempt(
        {
          code: 'replica_start_failed',
          message: `The replica build could not be started. ${(err as Error).message}`
        },
        row.attempt + 1
      );
    }

    return;
  }

  let remote = await genesis.machineImage.build.get({
    tenantId: row.tenant.id,
    buildId: row.genesisBuildId!
  });

  if (remote.status == 'awaiting_source') {
    await genesis.machineImage.build.refreshSource({
      tenantId: row.tenant.id,
      buildId: remote.id,
      source: await exportFromBuilder()
    });
  }

  if (
    remote.status == 'failed' ||
    remote.status == 'timed_out' ||
    remote.status == 'cancelled'
  ) {
    let failure = {
      code: remote.failure?.code ?? remote.status,
      message: remote.failure?.message ?? `The build ${remote.status.replace('_', ' ')}.`
    };

    if (row.kind == 'replica') {
      await failAttempt(failure, row.attempt);
    } else {
      await db.sandboxMachineImageBuildRegion.updateMany({
        where: { oid: row.oid, status: { notIn: terminalRegionStatuses } },
        data: {
          status: toRegionStatus(remote.status),
          failureCode: failure.code,
          failureMessage: failure.message,
          endedAt: new Date()
        }
      });
    }

    return;
  }

  if (remote.status != 'succeeded') {
    if (toRegionStatus(remote.status) != row.status) {
      await db.sandboxMachineImageBuildRegion.updateMany({
        where: { oid: row.oid, status: { notIn: terminalRegionStatuses } },
        data: {
          status: toRegionStatus(remote.status),
          logStreamId: remote.logStreamId
        }
      });
    }

    return;
  }

  let version = await genesis.machineImage.version.get({
    tenantId: row.tenant.id,
    imageId: row.genesisImageId!,
    versionId: remote.versionId!
  });

  let imageRegion = await db.sandboxMachineImageRegion.upsert({
    where: { imageOid_regionOid: { imageOid: row.build.imageOid, regionOid: row.regionOid } },
    create: {
      id: await ID.generateId('sandboxMachineImageRegion'),
      genesisId: row.genesisImageId!,
      imageOid: row.build.imageOid,
      regionOid: row.regionOid,
      tenantOid: row.tenantOid,
      lastSyncedAt: new Date()
    },
    update: {
      genesisId: row.genesisImageId!,
      tenantOid: row.tenantOid,
      status: 'active',
      lastSyncedAt: new Date()
    }
  });

  await db.sandboxMachineImageVersionRegion.upsert({
    where: {
      versionOid_regionOid: { versionOid: row.build.versionOid, regionOid: row.regionOid }
    },
    create: {
      id: await ID.generateId('sandboxMachineImageVersionRegion'),
      genesisId: version.id,
      digest: version.digest,
      versionOid: row.build.versionOid,
      imageRegionOid: imageRegion.oid,
      regionOid: row.regionOid,
      lastSyncedAt: new Date()
    },
    update: {
      genesisId: version.id,
      digest: version.digest,
      imageRegionOid: imageRegion.oid,
      status: 'active',
      lastSyncedAt: new Date()
    }
  });

  await db.sandboxMachineImageBuildRegion.updateMany({
    where: { oid: row.oid, status: { notIn: terminalRegionStatuses } },
    data: { status: 'succeeded', endedAt: new Date() }
  });
});

export let imageBuildProcessors = combineQueueProcessors([
  imageBuildRootQueueProcessor,
  imageBuildRegionQueueProcessor
]);
