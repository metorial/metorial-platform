import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { protoGuardConfigService } from '@metorial-subspace/module-monitor';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { protoGuardConfigPresenter } from '../../../presenters';
import { getRequiredParam } from './_shared';

type ProtoGuardConfig = Awaited<ReturnType<typeof protoGuardConfigService.listFilters>>;

export let protoGuardConfigController = Controller.create(
  {
    name: 'ProtoGuard Config',
    description: 'ProtoGuard config controls prompt-injection filters and alert thresholds.'
  },
  {
    get: instanceGroup
      .get(instancePath('protoguard-config', 'protoGuardConfig.get'), {
        name: 'Get ProtoGuard config',
        description: 'Retrieves ProtoGuard filter configuration for this instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .output(protoGuardConfigPresenter)
      .do(async ctx => {
        let config = await protoGuardConfigService.listFilters({
          instance: ctx.instance
        });

        return protoGuardConfigPresenter.present({ config });
      }),

    updateFilter: instanceGroup
      .post(
        instancePath('protoguard-config/filters/:filterId', 'protoGuardConfig.updateFilter'),
        {
          name: 'Update ProtoGuard filter config',
          description: 'Updates ProtoGuard filter settings for this instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.monitor:write'] }))
      .body(
        'default',
        v.object({
          enabled: v.optional(v.boolean()),
          alert_confidence_threshold: v.optional(v.nullable(v.number()))
        })
      )
      .output(protoGuardConfigPresenter)
      .do(async ctx => {
        let filterId = getRequiredParam(ctx.params, 'filterId');
        let config: ProtoGuardConfig | undefined;

        if (ctx.body.enabled !== undefined) {
          await protoGuardConfigService.setTenantFilterEnabled({
            instance: ctx.instance,
            filterId,
            enabled: ctx.body.enabled
          });
          config = await protoGuardConfigService.listFilters({
            instance: ctx.instance
          });
        }

        if (ctx.body.alert_confidence_threshold !== undefined) {
          await protoGuardConfigService.setTenantFilterAlertConfidenceThreshold({
            instance: ctx.instance,
            filterId,
            threshold: ctx.body.alert_confidence_threshold
          });
          config = await protoGuardConfigService.listFilters({
            instance: ctx.instance
          });
        }

        if (!config) {
          throw new ServiceError(
            badRequestError({
              message: 'No ProtoGuard filter config fields provided',
              description:
                'Provide at least one of enabled or alert_confidence_threshold in the request body.'
            })
          );
        }

        return protoGuardConfigPresenter.present({ config });
      }),

    setAlertFilterCountThreshold: instanceGroup
      .post(
        instancePath(
          'protoguard-config/alert-filter-count-threshold',
          'protoGuardConfig.setAlertFilterCountThreshold'
        ),
        {
          name: 'Set ProtoGuard alert filter count threshold',
          description:
            'Sets or clears the number of matching ProtoGuard filters required to create an alert.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.monitor:write'] }))
      .body(
        'default',
        v.object({
          threshold: v.nullable(v.number())
        })
      )
      .output(protoGuardConfigPresenter)
      .do(async ctx => {
        await protoGuardConfigService.setTenantAlertFilterCountThreshold({
          instance: ctx.instance,
          threshold: ctx.body.threshold
        });

        let config = await protoGuardConfigService.listFilters({
          instance: ctx.instance
        });

        return protoGuardConfigPresenter.present({ config });
      })
  }
);
