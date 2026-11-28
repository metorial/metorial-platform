import { v } from '@lowerdeck/validation';
import type { ConsumerDeviceConnectionMode } from '@metorial/db';
import { resource } from '../../_lib/resource';

export let consumerDeviceSettingsAuditResource = resource({
  name: 'consumer_device_settings',
  payload: v.typedAny<{
    id: string;
    aiToolDetectionEnabled: boolean;
    connectionMode: ConsumerDeviceConnectionMode;
    privacyNoticeAcceptedAt: Date | null;
  }>('consumer_device_settings'),
  presenter: undefined,
  actions: {
    create: true,
    update: true
  }
});
