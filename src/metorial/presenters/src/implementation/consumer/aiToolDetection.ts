import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { aiToolDetectionType } from '../../types';
import { aiToolPolicyStatusDescription, aiToolPolicyStatusValues } from './aiTool';
import { detectionFieldSchemas, presentDeviceDetection } from './consumerDeviceDetection';

export let v1AiToolDetectionPresenter = Presenter.create(aiToolDetectionType)
  .presenter(async ({ detection, policy }) => {
    let { object: _object, ...fields } = presentDeviceDetection(
      detection,
      detection.consumerDevice
    );

    return {
      object: 'ai_tool.detection' as const,
      ...fields,

      policy_status: policy?.status ?? ('unreviewed' as const),

      consumer_device_id: detection.consumerDevice.id,
      consumer_profile_id: detection.consumerDevice.consumerProfile.id,
      consumer_id: detection.consumerDevice.consumerProfile.consumer.id,

      gone_at: detection.goneAt
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
      consumer_profile_id: v.string({
        name: 'consumer_profile_id',
        description: 'Consumer profile that enrolled the device.'
      }),
      consumer_id: v.string({
        name: 'consumer_id',
        description: 'Consumer the device belongs to.'
      }),
      gone_at: v.nullable(
        v.date({
          name: 'gone_at',
          description:
            'When a report first left the tool out. `null` while the device still reports it.'
        })
      )
    })
  )
  .build();
