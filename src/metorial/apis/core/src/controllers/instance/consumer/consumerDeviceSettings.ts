import { v } from '@lowerdeck/validation';
import { consumerDeviceSettingsService } from '@metorial/module-consumer-core';
import { consumerDeviceSettingsPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { aiToolDetectionFlags, assertCanTurnOnDetection } from '../../../lib/aiToolDetection';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let settingsFlags = hasFlags(aiToolDetectionFlags);

export let consumerDeviceSettingsController = Controller.create(
  {
    name: 'Consumer Device Settings',
    description:
      'Consumer device settings decide what Metorial Desktop monitors on enrolled devices in an instance. AI tool detection stays off until an admin accepts its privacy notice, which governs the per-person data detections hold.',
    hideInDocs: true
  },
  {
    get: instanceGroup
      .get(instancePath('consumer-device-settings', 'consumerDeviceSettings.get'), {
        name: 'Get consumer device settings',
        description: 'Retrieves the consumer device settings of the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(settingsFlags)
      .output(consumerDeviceSettingsPresenter)
      .do(async ctx => {
        let settings = await consumerDeviceSettingsService.getSettings({
          instance: ctx.instance
        });

        return consumerDeviceSettingsPresenter.present({ instance: ctx.instance, settings });
      }),

    update: instanceGroup
      .patch(instancePath('consumer-device-settings', 'consumerDeviceSettings.update'), {
        name: 'Update consumer device settings',
        description:
          'Updates the consumer device settings of the instance. Omitted fields keep their current value. Devices pick up the change at their next check-in.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(settingsFlags)
      .body(
        'default',
        v.object({
          ai_tool_detection_enabled: v.optional(
            v.boolean({
              name: 'ai_tool_detection_enabled',
              description:
                'When `true`, Metorial Desktop looks for AI tools on enrolled devices and reports them. Fails with 412 until the privacy notice is accepted. Only a user signed in to the dashboard can set `true`; API keys get 403.'
            })
          ),
          privacy_notice_accepted: v.optional(
            v.boolean({
              name: 'privacy_notice_accepted',
              description:
                '`true` records that you accepted the privacy notice for AI tool detection; accepting again keeps the first acceptance time. Only a user signed in to the dashboard can accept; API keys get 403. `false` withdraws it, which requires detection to be off.'
            })
          )
        })
      )
      .output(consumerDeviceSettingsPresenter)
      .do(async ctx => {
        let input = {
          aiToolDetectionEnabled: ctx.body.ai_tool_detection_enabled,
          privacyNoticeAccepted: ctx.body.privacy_notice_accepted
        };
        assertCanTurnOnDetection(ctx, input);

        let settings = await consumerDeviceSettingsService.updateSettings({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input
        });

        return consumerDeviceSettingsPresenter.present({ instance: ctx.instance, settings });
      })
  }
);
