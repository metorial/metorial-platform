import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

export let recordProtoGuardFilterSettingUpdated = async (
  event: FabricEvents['protoguard.filter_setting.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'protoguard_filter_setting', 'update', {
      payload: event.setting,
      previousPayload: event.previousSetting
    })
  );
};

export let recordProtoGuardAlertThresholdUpdated = async (
  event: FabricEvents['protoguard.alert_threshold.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'protoguard_alert_threshold', 'update', {
      payload: event.threshold,
      previousPayload: event.previousThreshold
    })
  );
};

export let recordProtoGuardAlertCreated = async (
  event: FabricEvents['protoguard.alert.created:after']
) => {
  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(event.auditScope, 'protoguard_alert', 'create', {
      payload: event.alert,
      recordedAt: event.alert.createdAt
    })
  );
};

Fabric.listen('protoguard.filter_setting.updated:after', recordProtoGuardFilterSettingUpdated);
Fabric.listen(
  'protoguard.alert_threshold.updated:after',
  recordProtoGuardAlertThresholdUpdated
);
Fabric.listen('protoguard.alert.created:after', recordProtoGuardAlertCreated);
