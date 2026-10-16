import {
  db,
  type SandboxMachineImageBuildRegionStatus,
  type SandboxMachineImageBuildStatus
} from '@metorial/db';
import { sandboxImageInternalService } from '../internal/imageInternal';
import { imageBuildCancelRootQueue } from '../queues/imageBuildCancel';

export let terminalBuildStatuses: SandboxMachineImageBuildStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
  'timed_out'
];

export let terminalRegionStatuses: SandboxMachineImageBuildRegionStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
  'timed_out'
];

export let endImageBuild = async (d: {
  build: {
    oid: bigint;
    versionOid: bigint;
    regions: {
      oid: bigint;
      status: SandboxMachineImageBuildRegionStatus;
      genesisBuildId: string | null;
    }[];
  };
  status: SandboxMachineImageBuildStatus;
  failure: { code: string; message: string } | null;
}) => {
  let remaining = d.build.regions.filter(row => !terminalRegionStatuses.includes(row.status));

  let now = new Date();

  await db.sandboxMachineImageBuildRegion.updateMany({
    where: { oid: { in: remaining.map(row => row.oid) } },
    data: { status: 'cancelled', endedAt: now }
  });

  await db.sandboxMachineImageBuild.updateMany({
    where: { oid: d.build.oid, status: { notIn: terminalBuildStatuses } },
    data: {
      status: d.status,
      failureCode: d.failure?.code ?? null,
      failureMessage: d.failure?.message ?? null,
      endedAt: now
    }
  });

  if (remaining.some(row => row.genesisBuildId)) {
    await imageBuildCancelRootQueue.add({ buildOid: d.build.oid.toString() });
  }

  if (d.status != 'succeeded') {
    await db.sandboxMachineImageVersion.updateMany({
      where: { oid: d.build.versionOid, status: 'pending' },
      data: { status: 'deleted' }
    });
  }

  await sandboxImageInternalService.refreshAvailability();
};
