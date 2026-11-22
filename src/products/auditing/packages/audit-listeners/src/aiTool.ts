import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let aiToolPolicyPayload = (
  aiToolPolicy: FabricEvents['ai_tool.policy.updated:after']['aiToolPolicy']
) => ({
  id: aiToolPolicy.id,
  toolKey: aiToolPolicy.toolKey,
  status: aiToolPolicy.status,
  note: aiToolPolicy.note,
  decidedAt: aiToolPolicy.decidedAt
});

let consumerDeviceSettingsPayload = (
  settings: FabricEvents['consumer.device_settings.updated:after']['consumerDeviceSettings']
) => ({
  id: settings.id,
  aiToolDetectionEnabled: settings.aiToolDetectionEnabled,
  privacyNoticeAcceptedAt: settings.privacyNoticeAcceptedAt
});

export let recordAiToolPolicyUpdated = async (
  event: FabricEvents['ai_tool.policy.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    if (!event.previousAiToolPolicy) {
      await auditTrackerService.recordEvent(event.auditScope, 'ai_tool_policy', 'create', {
        payload: aiToolPolicyPayload(event.aiToolPolicy),
        recordedAt
      });
      return;
    }

    await auditTrackerService.recordEvent(event.auditScope, 'ai_tool_policy', 'update', {
      payload: aiToolPolicyPayload(event.aiToolPolicy),
      previousPayload: aiToolPolicyPayload(event.previousAiToolPolicy),
      recordedAt
    });
  });
};

export let recordConsumerDeviceSettingsUpdated = async (
  event: FabricEvents['consumer.device_settings.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    if (!event.previousConsumerDeviceSettings) {
      await auditTrackerService.recordEvent(
        event.auditScope,
        'consumer_device_settings',
        'create',
        { payload: consumerDeviceSettingsPayload(event.consumerDeviceSettings), recordedAt }
      );
      return;
    }

    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_device_settings',
      'update',
      {
        payload: consumerDeviceSettingsPayload(event.consumerDeviceSettings),
        previousPayload: consumerDeviceSettingsPayload(event.previousConsumerDeviceSettings),
        recordedAt
      }
    );
  });
};

Fabric.listen('ai_tool.policy.updated:after', recordAiToolPolicyUpdated);
Fabric.listen('consumer.device_settings.updated:after', recordConsumerDeviceSettingsUpdated);
