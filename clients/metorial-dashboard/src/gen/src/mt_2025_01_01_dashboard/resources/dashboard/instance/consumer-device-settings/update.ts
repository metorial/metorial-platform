import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceConsumerDeviceSettingsUpdateOutput = {
  object: 'consumer.device_settings';
  instanceId: string;
  aiToolDetectionEnabled: boolean;
  connectionMode: 'local_proxy' | 'direct';
  privacyNoticeAcceptedAt: Date | null;
  updatedAt: Date | null;
};

export let mapDashboardInstanceConsumerDeviceSettingsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceConsumerDeviceSettingsUpdateOutput>(
    [
      'instance_id',
      'ai_tool_detection_enabled',
      'connection_mode',
      'privacy_notice_accepted_at',
      'updated_at'
    ],
    1
  );

export type DashboardInstanceConsumerDeviceSettingsUpdateBody = {
  aiToolDetectionEnabled?: boolean | undefined;
  privacyNoticeAccepted?: boolean | undefined;
  connectionMode?: 'local_proxy' | 'direct' | undefined;
};

export let mapDashboardInstanceConsumerDeviceSettingsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceConsumerDeviceSettingsUpdateBody>([
    'ai_tool_detection_enabled',
    'privacy_notice_accepted',
    'connection_mode'
  ]);
