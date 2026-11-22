import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceConsumerDeviceSettingsGetOutput = {
  object: 'consumer.device_settings';
  instanceId: string;
  aiToolDetectionEnabled: boolean;
  privacyNoticeAcceptedAt: Date | null;
  updatedAt: Date | null;
};

export let mapDashboardInstanceConsumerDeviceSettingsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceConsumerDeviceSettingsGetOutput>(
    [
      'instance_id',
      'ai_tool_detection_enabled',
      'privacy_notice_accepted_at',
      'updated_at'
    ],
    1
  );
