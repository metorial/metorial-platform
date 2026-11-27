import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { protoGuardConfigService } from '@metorial-subspace/module-monitor';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { protoGuardConfigPresenter } from '@metorial/presenters';
import { getRequiredParam } from './_shared';

type ProtoGuardConfig = Awaited<ReturnType<typeof protoGuardConfigService.listFilters>>;

export let protoGuardConfigController = Controller.create(
  {
    name: 'ProtoGuard Config',
    description:
      'ProtoGuard config is the prompt-injection filter set for an instance. It controls which filters run and when they raise alerts.'
  },
  {
    get: integrationsGroup
      .get(instancePath('protoguard-config', 'protoGuardConfig.get'), {
        name: 'Get ProtoGuard config',
        description: 'Retrieves the ProtoGuard config for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .output(protoGuardConfigPresenter)
      .do(async ctx => {
        let config = await protoGuardConfigService.listFilters({
          instance: ctx.instance
        });

        return protoGuardConfigPresenter.present({ config });
      }),

    update: integrationsGroup
      .patch(instancePath('protoguard-config', 'protoGuardConfig.update'), {
        name: 'Update ProtoGuard config',
        description:
          'Enables or disables ProtoGuard for this instance and sets its alert thresholds.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:manage'] }))
      .body(
        'default',
        v.object({
          enabled: v.optional(
            v.boolean({
              name: 'enabled',
              description:
                'Analyzes session messages for prompt injection when `true`. Set to `false` to stop analysis.'
            })
          ),
          alert_probability_threshold: v.optional(
            v.nullable(
              v.number({
                name: 'alert_probability_threshold',
                description:
                  'The combined injection probability, above 0 and at most 1, at which a message raises an alert. Pass null to restore the default.',
                examples: [0.8]
              })
            )
          ),
          alert_filter_count_threshold: v.optional(
            v.nullable(
              v.number({
                name: 'alert_filter_count_threshold',
                description:
                  'The number of triggered filters at which a message raises an alert. Pass null to restore the default.',
                examples: [2]
              })
            )
          )
        })
      )
      .output(protoGuardConfigPresenter)
      .do(async ctx => {
        await protoGuardConfigService.updateTenantSettings({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            enabled: ctx.body.enabled,
            alertProbabilityThreshold: ctx.body.alert_probability_threshold,
            alertFilterCountThreshold: ctx.body.alert_filter_count_threshold
          }
        });

        let config = await protoGuardConfigService.listFilters({
          instance: ctx.instance
        });

        return protoGuardConfigPresenter.present({ config });
      }),

    updateFilter: integrationsGroup
      .post(
        instancePath('protoguard-config/filters/:filterId', 'protoGuardConfig.updateFilter'),
        {
          name: 'Update ProtoGuard filter config',
          description: 'Updates ProtoGuard filter settings for this instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.monitor:manage'] }))
      .body(
        'default',
        v.object({
          enabled: v.optional(
            v.boolean({
              description: 'Whether the filter runs for the instance.'
            })
          ),
          alert_confidence_threshold: v.optional(
            v.nullable(
              v.number({
                description:
                  'Confidence a match needs for the filter to count as triggered. Pass `null` to restore the default.'
              })
            )
          )
        })
      )
      .output(protoGuardConfigPresenter)
      .do(async ctx => {
        let filterId = getRequiredParam(ctx.params, 'filterId');
        let config: ProtoGuardConfig | undefined;

        if (ctx.body.enabled !== undefined) {
          await protoGuardConfigService.setTenantFilterEnabled({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
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
            auditScope: ctx.auditScope,
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

    setAlertFilterCountThreshold: integrationsGroup
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
      .use(checkAccess({ possibleScopes: ['instance.monitor:manage'] }))
      .body(
        'default',
        v.object({
          threshold: v.nullable(
            v.number({
              description:
                'Number of matching ProtoGuard filters required to create an alert. Pass `null` to clear it.'
            })
          )
        })
      )
      .output(protoGuardConfigPresenter)
      .do(async ctx => {
        await protoGuardConfigService.setTenantAlertFilterCountThreshold({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          threshold: ctx.body.threshold
        });

        let config = await protoGuardConfigService.listFilters({
          instance: ctx.instance
        });

        return protoGuardConfigPresenter.present({ config });
      })
  }
);
