import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceConsumerDeviceSettingsUpdateOutput = {
  object: 'consumer.device_settings';
  instanceId: string;
  aiToolDetectionEnabled: boolean;
  privacyNoticeAcceptedAt: Date | null;
  updatedAt: Date | null;
};

export let mapDashboardInstanceConsumerDeviceSettingsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceConsumerDeviceSettingsUpdateOutput>(
    [
      'instance_id',
      'ai_tool_detection_enabled',
      'privacy_notice_accepted_at',
      'updated_at'
    ],
    1
  );

export type DashboardInstanceConsumerDeviceSettingsUpdateBody = {
  aiToolDetectionEnabled?: boolean | undefined;
  privacyNoticeAccepted?: boolean | undefined;
};

export let mapDashboardInstanceConsumerDeviceSettingsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceConsumerDeviceSettingsUpdateBody>([
    'ai_tool_detection_enabled',
    'privacy_notice_accepted'
  ]);
