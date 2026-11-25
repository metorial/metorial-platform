import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerDeviceSettingsGetOutput = {
  object: 'consumer.device_settings';
  instanceId: string;
  aiToolDetectionEnabled: boolean;
  connectionMode: 'local_proxy' | 'direct';
  privacyNoticeAcceptedAt: Date | null;
  updatedAt: Date | null;
};

export let mapConsumerDeviceSettingsGetOutput =
  /* @__PURE__ */ mapObject<ConsumerDeviceSettingsGetOutput>(
    [
      'instance_id',
      'ai_tool_detection_enabled',
      'connection_mode',
      'privacy_notice_accepted_at',
      'updated_at'
    ],
    1
  );
