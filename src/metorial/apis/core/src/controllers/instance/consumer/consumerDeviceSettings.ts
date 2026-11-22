import { v } from '@lowerdeck/validation';
import { consumerDeviceSettingsService } from '@metorial/module-consumer-core';
import { consumerDeviceSettingsPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let settingsFlags = hasFlags([
  'paid-portals',
  'portals-access',
  'devices-enabled',
  'ai-tool-detection'
]);

export let consumerDeviceSettingsController = Controller.create(
  {
    name: 'Consumer Device Settings',
    description:
      'Consumer device settings decide what Metorial Desktop monitors on the devices consumers enroll in an instance. AI tool detection is off until an admin accepts the privacy notice and turns it on.',
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
                'When `true`, Metorial Desktop looks for AI tools on enrolled devices and reports them. Fails with 412 until the privacy notice is accepted.'
            })
          ),
          privacy_notice_accepted: v.optional(
            v.boolean({
              name: 'privacy_notice_accepted',
              description:
                '`true` records that you accepted the privacy notice for AI tool detection; accepting again keeps the first acceptance time. `false` withdraws it, which requires detection to be off.'
            })
          )
        })
      )
      .output(consumerDeviceSettingsPresenter)
      .do(async ctx => {
        let settings = await consumerDeviceSettingsService.updateSettings({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            aiToolDetectionEnabled: ctx.body.ai_tool_detection_enabled,
            privacyNoticeAccepted: ctx.body.privacy_notice_accepted
          }
        });

        return consumerDeviceSettingsPresenter.present({ instance: ctx.instance, settings });
      })
  }
);
