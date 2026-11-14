import {
  Fabric,
  type AuditSandboxDisk,
  type AuditSandboxImage,
  type AuditSandboxImageBuild,
  type AuditSandboxMachine,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let machinePayload = (machine: AuditSandboxMachine) => ({
  id: machine.id,
  name: machine.name,
  imageId: machine.imageId,
  regionIdentifier: machine.regionIdentifier,
  specMemoryMiB: machine.specMemoryMiB,
  specVcpus: machine.specVcpus
});

let diskPayload = (
  disk: AuditSandboxDisk,
  source?: { sourceDiskId: string | null; sourceImageId: string | null }
) => ({
  id: disk.id,
  name: disk.name,
  type: disk.type,
  sizeBytes: disk.sizeBytes,
  regionIdentifier: disk.regionIdentifier,
  ...source
});

let imagePayload = (image: AuditSandboxImage) => ({
  id: image.id,
  name: image.name
});

let imageBuildPayload = (build: AuditSandboxImageBuild) => ({
  id: build.id,
  imageId: build.imageId,
  status: build.status
});

export let recordSandboxMachineCreated = async (
  event: FabricEvents['sandbox.machine.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_machine', 'create', {
      payload: machinePayload(event.machine),
      recordedAt
    });
  });
};

export let recordSandboxMachineUpdated = async (
  event: FabricEvents['sandbox.machine.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_machine', 'update', {
      payload: machinePayload(event.machine),
      previousPayload: machinePayload(event.previousMachine),
      recordedAt
    });
  });
};

export let recordSandboxMachineDeleted = async (
  event: FabricEvents['sandbox.machine.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_machine', 'delete', {
      payload: machinePayload(event.machine),
      recordedAt
    });
  });
};

export let recordSandboxMachineLifecycle = async (
  event: FabricEvents['sandbox.machine.lifecycle:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_machine', event.action, {
      payload: machinePayload(event.machine),
      recordedAt
    });
  });
};

export let recordSandboxMachineAccessCreated = async (
  event: FabricEvents['sandbox.machine.access.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'sandbox_machine_access',
      'create',
      {
        payload: {
          machineId: event.machine.id,
          machineName: event.machine.name,
          kind: event.kind,
          ports: event.ports,
          ttlSeconds: event.ttlSeconds
        },
        recordedAt
      }
    );
  });
};

export let recordSandboxMachineExec = async (
  event: FabricEvents['sandbox.machine.exec:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_machine_exec', 'run', {
      payload: {
        machineId: event.machine.id,
        machineName: event.machine.name,
        commandByteSize: event.commandByteSize,
        outcome: event.outcome,
        exitCode: event.exitCode,
        timedOut: event.timedOut,
        durationMs: event.durationMs
      },
      recordedAt
    });
  });
};

export let recordSandboxDiskCreated = async (
  event: FabricEvents['sandbox.disk.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_disk', 'create', {
      payload: diskPayload(event.disk, {
        sourceDiskId: event.sourceDiskId,
        sourceImageId: event.sourceImageId
      }),
      recordedAt
    });
  });
};

export let recordSandboxDiskUpdated = async (
  event: FabricEvents['sandbox.disk.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_disk', 'update', {
      payload: diskPayload(event.disk),
      previousPayload: diskPayload(event.previousDisk),
      recordedAt
    });
  });
};

export let recordSandboxDiskDeleted = async (
  event: FabricEvents['sandbox.disk.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_disk', 'delete', {
      payload: diskPayload(event.disk),
      recordedAt
    });
  });
};

export let recordSandboxDiskResized = async (
  event: FabricEvents['sandbox.disk.resized:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'sandbox_disk_resize',
      event.retry ? 'retry' : 'create',
      {
        payload: {
          resizeId: event.resizeId,
          diskId: event.disk.id,
          diskName: event.disk.name,
          sizeBytes: event.sizeBytes
        },
        recordedAt
      }
    );
  });
};

export let recordSandboxImageCreated = async (
  event: FabricEvents['sandbox.image.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_image', 'create', {
      payload: imagePayload(event.image),
      recordedAt
    });
  });
};

export let recordSandboxImageUpdated = async (
  event: FabricEvents['sandbox.image.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_image', 'update', {
      payload: imagePayload(event.image),
      previousPayload: imagePayload(event.previousImage),
      recordedAt
    });
  });
};

export let recordSandboxImageDeleted = async (
  event: FabricEvents['sandbox.image.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_image', 'delete', {
      payload: imagePayload(event.image),
      recordedAt
    });
  });
};

export let recordSandboxImageBuildCreated = async (
  event: FabricEvents['sandbox.image.build.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_image_build', 'create', {
      payload: imageBuildPayload(event.build),
      recordedAt
    });
  });
};

export let recordSandboxImageBuildCancelled = async (
  event: FabricEvents['sandbox.image.build.cancelled:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'sandbox_image_build', 'cancel', {
      payload: imageBuildPayload(event.build),
      recordedAt
    });
  });
};

Fabric.listen('sandbox.machine.created:after', recordSandboxMachineCreated);
Fabric.listen('sandbox.machine.updated:after', recordSandboxMachineUpdated);
Fabric.listen('sandbox.machine.deleted:after', recordSandboxMachineDeleted);
Fabric.listen('sandbox.machine.lifecycle:after', recordSandboxMachineLifecycle);
Fabric.listen('sandbox.machine.access.created:after', recordSandboxMachineAccessCreated);
Fabric.listen('sandbox.machine.exec:after', recordSandboxMachineExec);

Fabric.listen('sandbox.disk.created:after', recordSandboxDiskCreated);
Fabric.listen('sandbox.disk.updated:after', recordSandboxDiskUpdated);
Fabric.listen('sandbox.disk.deleted:after', recordSandboxDiskDeleted);
Fabric.listen('sandbox.disk.resized:after', recordSandboxDiskResized);

Fabric.listen('sandbox.image.created:after', recordSandboxImageCreated);
Fabric.listen('sandbox.image.updated:after', recordSandboxImageUpdated);
Fabric.listen('sandbox.image.deleted:after', recordSandboxImageDeleted);
Fabric.listen('sandbox.image.build.created:after', recordSandboxImageBuildCreated);
Fabric.listen('sandbox.image.build.cancelled:after', recordSandboxImageBuildCancelled);
