import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerDeviceService, consumerDeviceStatuses } from '@metorial/module-consumer-core';
import { consumerDevicePresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let consumerDeviceGroup = instanceGroup.use(async ctx => {
  let consumerDevice = await consumerDeviceService.getDeviceById({
    instance: ctx.instance,
    consumerDeviceId: requireParam(ctx.params, 'consumerDeviceId')
  });

  return { consumerDevice };
});

export let consumerDeviceManagementController = Controller.create(
  {
    name: 'Consumer Devices',
    description: 'Inspect and revoke the Metorial Desktop devices consumers have enrolled.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('consumer-devices', 'consumers.devices.list'), {
        name: 'List consumer devices',
        description:
          'Returns the Metorial Desktop devices enrolled by consumers of an instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access', 'devices-enabled']))
      .query(
        'default',
        Paginator.validate(
          v.object({
            consumer_profile_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                name: 'consumer_profile_id',
                description: 'Only return devices enrolled by these consumer profiles.'
              })
            ),
            consumer_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                name: 'consumer_id',
                description: 'Only return devices enrolled by any profile of these consumers.'
              })
            ),
            status: v.optional(
              v.union(
                [v.enumOf(consumerDeviceStatuses), v.array(v.enumOf(consumerDeviceStatuses))],
                {
                  name: 'status',
                  description: 'Only return devices with these statuses. Defaults to active.'
                }
              )
            )
          })
        )
      )
      .outputList(consumerDevicePresenter)
      .do(async ctx => {
        let paginator = await consumerDeviceService.listDevices({
          instance: ctx.instance,
          consumerProfileIds: normalizeArrayParam(ctx.query.consumer_profile_id),
          consumerIds: normalizeArrayParam(ctx.query.consumer_id),
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerDevice =>
          consumerDevicePresenter.present({ consumerDevice })
        );
      }),

    get: consumerDeviceGroup
      .get(instancePath('consumer-devices/:consumerDeviceId', 'consumers.devices.get'), {
        name: 'Get consumer device',
        description: 'Retrieves a Metorial Desktop device enrolled by a consumer.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access', 'devices-enabled']))
      .output(consumerDevicePresenter)
      .do(async ctx =>
        consumerDevicePresenter.present({ consumerDevice: ctx.consumerDevice })
      ),

    revoke: consumerDeviceGroup
      .post(
        instancePath('consumer-devices/:consumerDeviceId/revoke', 'consumers.devices.revoke'),
        {
          name: 'Revoke consumer device',
          description:
            'Signs the device out and revokes its integration tokens. The app removes what it installed the next time it reaches Metorial.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access', 'devices-enabled']))
      .output(consumerDevicePresenter)
      .do(async ctx => {
        let consumerDevice = await consumerDeviceService.revokeDevice({
          consumerDevice: ctx.consumerDevice,
          auditScope: ctx.auditScope
        });

        return consumerDevicePresenter.present({ consumerDevice });
      })
  }
);
