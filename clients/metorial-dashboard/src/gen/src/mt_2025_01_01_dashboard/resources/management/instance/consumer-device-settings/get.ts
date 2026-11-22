import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceConsumerDeviceSettingsGetOutput = {
  object: 'consumer.device_settings';
  instanceId: string;
  aiToolDetectionEnabled: boolean;
  privacyNoticeAcceptedAt: Date | null;
  updatedAt: Date | null;
};

export let mapManagementInstanceConsumerDeviceSettingsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceConsumerDeviceSettingsGetOutput>(
    [
      'instance_id',
      'ai_tool_detection_enabled',
      'privacy_notice_accepted_at',
      'updated_at'
    ],
    1
  );
