import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerDeviceSettingsUpdateOutput = {
  object: 'consumer.device_settings';
  instanceId: string;
  aiToolDetectionEnabled: boolean;
  privacyNoticeAcceptedAt: Date | null;
  updatedAt: Date | null;
};

export let mapConsumerDeviceSettingsUpdateOutput =
  /* @__PURE__ */ mapObject<ConsumerDeviceSettingsUpdateOutput>(
    ['instance_id', 'ai_tool_detection_enabled', 'privacy_notice_accepted_at', 'updated_at'],
    1
  );

export type ConsumerDeviceSettingsUpdateBody = {
  aiToolDetectionEnabled?: boolean | undefined;
  privacyNoticeAccepted?: boolean | undefined;
};

export let mapConsumerDeviceSettingsUpdateBody =
  /* @__PURE__ */ mapObject<ConsumerDeviceSettingsUpdateBody>([
    'ai_tool_detection_enabled',
    'privacy_notice_accepted'
  ]);
