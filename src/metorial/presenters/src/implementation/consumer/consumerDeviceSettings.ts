import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerDeviceSettingsType } from '../../types';

export let v1ConsumerDeviceSettingsPresenter = Presenter.create(consumerDeviceSettingsType)
  .presenter(async ({ instance, settings }) => ({
    object: 'consumer.device_settings' as const,
    instance_id: instance.id,
    ai_tool_detection_enabled: settings?.aiToolDetectionEnabled ?? false,
    privacy_notice_accepted_at: settings?.privacyNoticeAcceptedAt ?? null,
    updated_at: settings?.updatedAt ?? null
  }))
  .schema(
    v.object({
      object: v.literal('consumer.device_settings', {
        description: 'String representing the object’s type.'
      }),
      instance_id: v.string({
        name: 'instance_id',
        description: 'Instance these settings apply to.'
      }),
      ai_tool_detection_enabled: v.boolean({
        name: 'ai_tool_detection_enabled',
        description:
          'When `true`, Metorial Desktop looks for AI tools on enrolled devices and reports what it finds. Off by default.'
      }),
      privacy_notice_accepted_at: v.nullable(
        v.date({
          name: 'privacy_notice_accepted_at',
          description:
            'When an admin accepted the privacy notice for AI tool detection. `null` until accepted; detection can only be turned on after that. The notice governs what detection collects per person: detections name the consumer and email address of each device, even where agent usage hides individuals.'
        })
      ),
      updated_at: v.nullable(
        v.date({
          name: 'updated_at',
          description: 'Last update time. `null` while the settings were never changed.'
        })
      )
    })
  )
  .build();
