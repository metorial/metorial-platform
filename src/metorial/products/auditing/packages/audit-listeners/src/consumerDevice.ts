import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let consumerDevicePayload = (
  consumerDevice: FabricEvents['consumer.device.enrolled:after']['consumerDevice']
) => ({
  id: consumerDevice.id,
  consumerProfileId: consumerDevice.consumerProfile.id,
  consumerProfileEmail: consumerDevice.consumerProfile.email,
  name: consumerDevice.name,
  os: consumerDevice.os,
  arch: consumerDevice.arch,
  appVersion: consumerDevice.appVersion,
  status: consumerDevice.status,
  clients: consumerDevice.clientSettings.map(setting => ({
    key: setting.clientKey,
    enabled: setting.enabled,
    excludedMagicMcpServerCount: setting.excludedMagicMcpServerIds.length,
    excludedSkillCount: setting.excludedSkillIds.length
  })),
  revokedAt: consumerDevice.revokedAt
});

export let recordConsumerDeviceEnrolled = async (
  event: FabricEvents['consumer.device.enrolled:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_device', 'create', {
      payload: consumerDevicePayload(event.consumerDevice),
      recordedAt
    });
  });
};

export let recordConsumerDeviceUpdated = async (
  event: FabricEvents['consumer.device.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_device', 'update', {
      payload: consumerDevicePayload(event.consumerDevice),
      previousPayload: consumerDevicePayload(event.previousConsumerDevice),
      recordedAt
    });
  });
};

export let recordConsumerDeviceEnded = async (
  event: FabricEvents['consumer.device.ended:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    if (event.consumerDevice.status == 'revoked') {
      await auditTrackerService.recordEvent(event.auditScope, 'consumer_device', 'delete', {
        payload: consumerDevicePayload(event.consumerDevice),
        recordedAt
      });
      return;
    }

    await auditTrackerService.recordEvent(event.auditScope, 'consumer_device', 'update', {
      payload: consumerDevicePayload(event.consumerDevice),
      previousPayload: consumerDevicePayload(event.previousConsumerDevice),
      recordedAt
    });
  });
};

Fabric.listen('consumer.device.enrolled:after', recordConsumerDeviceEnrolled);
Fabric.listen('consumer.device.updated:after', recordConsumerDeviceUpdated);
Fabric.listen('consumer.device.ended:after', recordConsumerDeviceEnded);
