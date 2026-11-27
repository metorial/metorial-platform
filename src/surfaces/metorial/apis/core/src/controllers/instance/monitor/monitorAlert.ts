import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { alertService } from '@metorial-subspace/module-monitor';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { monitorAlertPresenter } from '@metorial/presenters';
import {
  actorInput,
  getRequiredParam,
  monitorAlertSourceValidator,
  monitorAlertStatusValidator,
  monitorTargetValidator,
  stringOrArray
} from './_shared';

let monitorAlertGroup = integrationsGroup.use(async ctx => {
  let alert = await alertService.getAlertById({
    instance: ctx.instance,
    alertId: getRequiredParam(ctx.params, 'monitorAlertId'),
    ...actorInput(ctx)
  });

  return { alert };
});

export let monitorAlertController = Controller.create(
  {
    name: 'Monitor Alerts',
    description:
      'A monitor alert is one firing of a monitor. It records a detected prompt-injection or schema-change event.'
  },
  {
    list: integrationsGroup
      .get(instancePath('monitor-alerts', 'monitorAlerts.list'), {
        name: 'List monitor alerts',
        description: 'Returns a paginated list of monitor alerts in the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .outputList(monitorAlertPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray(), {
              description: 'Only return monitor alerts with one of these IDs.'
            }),
            monitor_id: v.optional(stringOrArray(), {
              description: 'Only return alerts from one of these monitors.'
            }),
            status: v.optional(
              v.union([monitorAlertStatusValidator, v.array(monitorAlertStatusValidator)]),
              {
                description: 'Only return monitor alerts with one of these statuses.'
              }
            ),
            target: v.optional(
              v.union([monitorTargetValidator, v.array(monitorTargetValidator)]),
              {
                description: 'Only return monitor alerts watching one of these targets.'
              }
            ),
            source: v.optional(
              v.union([monitorAlertSourceValidator, v.array(monitorAlertSourceValidator)]),
              {
                description: 'Only return monitor alerts from one of these sources.'
              }
            ),
            provider_id: v.optional(stringOrArray(), {
              description: 'Only return monitor alerts for one of these providers.'
            }),
            proto_guard_alert_id: v.optional(stringOrArray(), {
              description:
                'Only return monitor alerts linked to one of these ProtoGuard alerts.'
            }),
            proto_guard_run_id: v.optional(stringOrArray(), {
              description: 'Only return monitor alerts linked to one of these ProtoGuard runs.'
            }),
            proto_guard_filter_id: v.optional(stringOrArray(), {
              description:
                'Only return monitor alerts linked to one of these ProtoGuard filters.'
            }),
            specification_change_notification_id: v.optional(stringOrArray(), {
              description:
                'Only return monitor alerts linked to one of these specification change notifications.'
            }),
            session_id: v.optional(stringOrArray(), {
              description: 'Only return monitor alerts linked to one of these sessions.'
            }),
            session_message_id: v.optional(stringOrArray(), {
              description:
                'Only return monitor alerts linked to one of these session messages.'
            }),
            session_connection_id: v.optional(stringOrArray(), {
              description:
                'Only return monitor alerts linked to one of these session connections.'
            }),
            provider_run_id: v.optional(stringOrArray(), {
              description: 'Only return monitor alerts linked to one of these provider runs.'
            }),
            created_at: dateFilterValidator('monitor alert creation time'),
            resolved_at: dateFilterValidator('monitor alert resolution time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await alertService.listAlerts({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          monitorIds: normalizeArrayParam(ctx.query.monitor_id),
          statuses: normalizeArrayParam(ctx.query.status),
          targets: normalizeArrayParam(ctx.query.target),
          sources: normalizeArrayParam(ctx.query.source),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          protoGuardAlertIds: normalizeArrayParam(ctx.query.proto_guard_alert_id),
          protoGuardRunIds: normalizeArrayParam(ctx.query.proto_guard_run_id),
          protoGuardFilterIds: normalizeArrayParam(ctx.query.proto_guard_filter_id),
          specificationChangeNotificationIds: normalizeArrayParam(
            ctx.query.specification_change_notification_id
          ),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionMessageIds: normalizeArrayParam(ctx.query.session_message_id),
          sessionConnectionIds: normalizeArrayParam(ctx.query.session_connection_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id),
          createdAt: ctx.query.created_at,
          resolvedAt: ctx.query.resolved_at
        });

        return Paginator.present(await paginator.run(ctx.query), alert =>
          monitorAlertPresenter.present({ alert })
        );
      }),

    get: monitorAlertGroup
      .get(instancePath('monitor-alerts/:monitorAlertId', 'monitorAlerts.get'), {
        name: 'Get monitor alert',
        description: 'Retrieves a monitor alert.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .output(monitorAlertPresenter)
      .do(async ctx => monitorAlertPresenter.present({ alert: ctx.alert })),

    viewed: integrationsGroup
      .post(instancePath('monitor-alerts/:monitorAlertId/viewed', 'monitorAlerts.viewed'), {
        name: 'Mark monitor alert viewed',
        description: 'Marks a monitor alert as viewed by the current actor.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:write'] }))
      .output(monitorAlertPresenter)
      .do(async ctx => {
        let alert = await alertService.markViewed({
          instance: ctx.instance,
          alertId: getRequiredParam(ctx.params, 'monitorAlertId'),
          ...actorInput(ctx)
        });

        return monitorAlertPresenter.present({ alert });
      }),

    resolve: integrationsGroup
      .post(instancePath('monitor-alerts/:monitorAlertId/resolve', 'monitorAlerts.resolve'), {
        name: 'Resolve monitor alert',
        description: 'Marks a monitor alert as resolved.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:write'] }))
      .output(monitorAlertPresenter)
      .do(async ctx => {
        let alert = await alertService.resolveAlert({
          instance: ctx.instance,
          alertId: getRequiredParam(ctx.params, 'monitorAlertId'),
          ...actorInput(ctx)
        });

        return monitorAlertPresenter.present({ alert });
      }),

    unresolve: integrationsGroup
      .post(
        instancePath('monitor-alerts/:monitorAlertId/unresolve', 'monitorAlerts.unresolve'),
        {
          name: 'Unresolve monitor alert',
          description: 'Reopens a resolved monitor alert.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.monitor:write'] }))
      .output(monitorAlertPresenter)
      .do(async ctx => {
        let alert = await alertService.unresolveAlert({
          instance: ctx.instance,
          alertId: getRequiredParam(ctx.params, 'monitorAlertId'),
          ...actorInput(ctx)
        });

        return monitorAlertPresenter.present({ alert });
      })
  }
);
