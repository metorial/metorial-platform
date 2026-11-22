import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { aiToolDetectionType } from '../../types';
import {
  aiToolPolicyStatusDescription,
  aiToolPolicyStatusValues,
  activeUseWindowDays
} from './aiTool';
import { detectionFieldSchemas, presentDeviceDetection } from './consumerDeviceDetection';

export let v1AiToolDetectionPresenter = Presenter.create(aiToolDetectionType)
  .presenter(async ({ detection, policy, lastUsedAt }) => {
    let { object: _object, ...fields } = presentDeviceDetection(
      detection,
      detection.consumerDevice
    );

    return {
      object: 'ai_tool.detection' as const,
      ...fields,

      policy_status: policy?.status ?? ('unreviewed' as const),

      consumer_device_id: detection.consumerDevice.id,
      consumer_device_name: detection.consumerDevice.name,
      consumer_device_os: detection.consumerDevice.os,
      consumer_profile_id: detection.consumerDevice.consumerProfile.id,
      consumer_id: detection.consumerDevice.consumerProfile.consumer.id,
      consumer_name: detection.consumerDevice.consumerProfile.consumer.name,
      consumer_email: detection.consumerDevice.consumerProfile.consumer.email,

      gone_at: detection.goneAt,

      actively_used: (!detection.goneAt && detection.state == 'running') || !!lastUsedAt,
      last_used_at: lastUsedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('ai_tool.detection', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ name: 'id', description: 'Unique ID.', examples: ['codd_0mfz6q2xbb'] }),
      ...detectionFieldSchemas,
      policy_status: v.enumOf([...aiToolPolicyStatusValues], {
        name: 'policy_status',
        description: `Approval status of the tool in this instance. ${aiToolPolicyStatusDescription}`
      }),
      consumer_device_id: v.string({
        name: 'consumer_device_id',
        description: 'Device the tool was found on.'
      }),
      consumer_device_name: v.string({
        name: 'consumer_device_name',
        description: 'Name of the device, as its operating system reports it.',
        examples: ['Ada’s MacBook Pro']
      }),
      consumer_device_os: v.string({
        name: 'consumer_device_os',
        description: 'Operating system of the device.',
        examples: ['macos', 'windows']
      }),
      consumer_profile_id: v.string({
        name: 'consumer_profile_id',
        description: 'Consumer profile that enrolled the device.'
      }),
      consumer_id: v.string({
        name: 'consumer_id',
        description: 'Consumer the device belongs to.'
      }),
      consumer_name: v.string({
        name: 'consumer_name',
        description: 'Name of the consumer the device belongs to.'
      }),
      consumer_email: v.string({
        name: 'consumer_email',
        description: 'Email address of the consumer the device belongs to.'
      }),
      gone_at: v.nullable(
        v.date({
          name: 'gone_at',
          description:
            'When a report first left the tool out. `null` while the device still reports it.'
        })
      ),
      actively_used: v.boolean({
        name: 'actively_used',
        description:
          '`true` when the device reports the tool running, or when `last_used_at` is set. Without agent usage tracking, or while the organization hides individuals in agent usage, only a running tool counts.'
      }),
      last_used_at: v.nullable(
        v.date({
          name: 'last_used_at',
          description: `When agent usage tracking last saw this consumer use the tool, on any device, in the last ${activeUseWindowDays} days. \`null\` when it saw no use or cannot show individual usage.`
        })
      )
    })
  )
  .build();
