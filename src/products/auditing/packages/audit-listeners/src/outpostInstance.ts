import type { OutpostInstance, OutpostInstanceService } from '@metorial/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let outpostInstancePayload = (
  instance: OutpostInstance,
  outpostId: string,
  services?: OutpostInstanceService[]
) => ({
  id: instance.id,
  status: instance.status,
  outpostId,
  name: instance.identifier,
  keyRotationCount: instance.keyRotationCount,
  registrationCount: instance.registrationCount,
  expiresAt: instance.expiresAt,
  ...(services
    ? {
        services: services.map(service => ({
          service: service.service,
          version: service.version,
          granted: service.granted
        }))
      }
    : {})
});

export let recordOutpostInstanceRegistered = async (
  event: FabricEvents['outpost_instance.registered:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_instance', 'register', {
      payload: outpostInstancePayload(event.instance, event.outpost.id, event.services),
      previousPayload: event.previousInstance
        ? outpostInstancePayload(event.previousInstance, event.outpost.id)
        : undefined,
      recordedAt
    });
  });
};

export let recordOutpostInstanceKeyRotated = async (
  event: FabricEvents['outpost_instance.key_rotated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_instance', 'rotate_key', {
      payload: outpostInstancePayload(event.instance, event.outpost.id),
      previousPayload: outpostInstancePayload(event.previousInstance, event.outpost.id),
      recordedAt
    });
  });
};

export let recordOutpostInstanceDeactivated = async (
  event: FabricEvents['outpost_instance.deactivated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_instance', 'deactivate', {
      payload: outpostInstancePayload(event.instance, event.outpost.id),
      previousPayload: outpostInstancePayload(event.previousInstance, event.outpost.id),
      recordedAt
    });
  });
};

export let recordOutpostInstancePruned = async (
  event: FabricEvents['outpost_instance.pruned:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_instance', 'prune', {
      payload: {
        ...outpostInstancePayload(event.instance, event.outpost.id),
        deleted: event.deleted
      },
      recordedAt
    });
  });
};

export let recordOutpostInstanceDeleted = async (
  event: FabricEvents['outpost_instance.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_instance', 'delete', {
      payload: outpostInstancePayload(event.instance, event.outpost.id),
      recordedAt
    });
  });
};

Fabric.listen('outpost_instance.registered:after', recordOutpostInstanceRegistered);
Fabric.listen('outpost_instance.key_rotated:after', recordOutpostInstanceKeyRotated);
Fabric.listen('outpost_instance.deactivated:after', recordOutpostInstanceDeactivated);
Fabric.listen('outpost_instance.pruned:after', recordOutpostInstancePruned);
Fabric.listen('outpost_instance.deleted:after', recordOutpostInstanceDeleted);
