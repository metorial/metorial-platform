import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  aiToolPolicyService,
  aiToolPolicyStatuses,
  consumerDeviceDetectionService,
  consumerDeviceDetectionStatuses
} from '@metorial/module-consumer-core';
import { aiToolDetectionPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let maxFilterValues = 100;
let maxFilterValueLength = 128;

let idFilter = (name: string, description: string) =>
  v.optional(
    v.union(
      [
        v.string({ modifiers: [v.maxLength(maxFilterValueLength)] }),
        v.array(v.string({ modifiers: [v.maxLength(maxFilterValueLength)] }), {
          modifiers: [v.maxLength(maxFilterValues)]
        })
      ],
      { name, description: `${description} Up to ${maxFilterValues} values.` }
    )
  );

export let aiToolDetectionController = Controller.create(
  {
    name: 'AI Tool Detections',
    description:
      'An AI tool detection records that Metorial Desktop found an AI tool on an enrolled device. It is updated by every report the device sends and marked gone once a report leaves the tool out.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('ai-tool-detections', 'aiToolDetections.list'), {
        name: 'List AI tool detections',
        description:
          'Returns a paginated list of AI tool detections on signed-in devices. By default only tools the devices still report are returned.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(
        hasFlags(['paid-portals', 'portals-access', 'devices-enabled', 'ai-tool-detection'])
      )
      .query(
        'default',
        Paginator.validate(
          v.object({
            consumer_id: idFilter(
              'consumer_id',
              'Only return detections on devices of these consumers.'
            ),
            consumer_profile_id: idFilter(
              'consumer_profile_id',
              'Only return detections on devices enrolled by these consumer profiles.'
            ),
            consumer_device_id: idFilter(
              'consumer_device_id',
              'Only return detections on these devices.'
            ),
            tool_key: idFilter('tool_key', 'Only return detections of these AI tools.'),
            policy_status: v.optional(
              v.union(
                [v.enumOf(aiToolPolicyStatuses), v.array(v.enumOf(aiToolPolicyStatuses))],
                {
                  name: 'policy_status',
                  description:
                    'Only return detections of tools with these approval statuses. Pass `not_sanctioned` and `unreviewed` to list shadow AI.'
                }
              )
            ),
            status: v.optional(
              v.union(
                [
                  v.enumOf([...consumerDeviceDetectionStatuses]),
                  v.array(v.enumOf([...consumerDeviceDetectionStatuses]))
                ],
                {
                  name: 'status',
                  description:
                    'Only return detections the devices still report (`present`) or no longer report (`gone`). Defaults to `present`.'
                }
              )
            )
          })
        )
      )
      .outputList(aiToolDetectionPresenter)
      .do(async ctx => {
        let paginator = await consumerDeviceDetectionService.listDetections({
          instance: ctx.instance,
          consumerIds: normalizeArrayParam(ctx.query.consumer_id),
          consumerProfileIds: normalizeArrayParam(ctx.query.consumer_profile_id),
          consumerDeviceIds: normalizeArrayParam(ctx.query.consumer_device_id),
          toolKeys: normalizeArrayParam(ctx.query.tool_key),
          policyStatuses: normalizeArrayParam(ctx.query.policy_status),
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let [list, policies] = await Promise.all([
          paginator.run(ctx.query),
          aiToolPolicyService.listPolicies({ instance: ctx.instance })
        ]);

        return Paginator.present(list, detection =>
          aiToolDetectionPresenter.present({
            detection,
            policy: policies.get(detection.toolKey) ?? null
          })
        );
      })
  }
);
