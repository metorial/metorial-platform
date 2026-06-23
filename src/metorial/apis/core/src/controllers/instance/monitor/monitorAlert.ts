import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceMonitorAlertService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { monitorAlertPresenter } from '../../../presenters';
import {
  actorInput,
  getRequiredParam,
  monitorAlertSourceValidator,
  monitorAlertStatusValidator,
  monitorTargetValidator,
  stringOrArray
} from './_shared';

let monitorAlertGroup = instanceGroup.use(async ctx => {
  let alert = await subspaceMonitorAlertService.get({
    instance: ctx.instance,
    alertId: getRequiredParam(ctx.params, 'monitorAlertId'),
    ...actorInput(ctx)
  });

  return { alert };
});

export let monitorAlertController = Controller.create(
  {
    name: 'Monitor Alerts',
    description: 'Monitor alerts represent detected prompt-injection or schema-change events.'
  },
  {
    list: instanceGroup
      .get(instancePath('monitor-alerts', 'monitorAlerts.list'), {
        name: 'List monitor alerts',
        description: 'Returns a paginated list of monitor alerts for this instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .outputList(monitorAlertPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray()),
            monitor_id: v.optional(stringOrArray()),
            status: v.optional(
              v.union([monitorAlertStatusValidator, v.array(monitorAlertStatusValidator)])
            ),
            target: v.optional(
              v.union([monitorTargetValidator, v.array(monitorTargetValidator)])
            ),
            source: v.optional(
              v.union([monitorAlertSourceValidator, v.array(monitorAlertSourceValidator)])
            ),
            provider_id: v.optional(stringOrArray()),
            proto_guard_alert_id: v.optional(stringOrArray()),
            proto_guard_run_id: v.optional(stringOrArray()),
            proto_guard_filter_id: v.optional(stringOrArray()),
            specification_change_notification_id: v.optional(stringOrArray()),
            session_id: v.optional(stringOrArray()),
            session_message_id: v.optional(stringOrArray()),
            session_connection_id: v.optional(stringOrArray()),
            provider_run_id: v.optional(stringOrArray()),
            created_at: dateFilterValidator('monitor alert creation time'),
            resolved_at: dateFilterValidator('monitor alert resolution time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceMonitorAlertService.list({
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
        description: 'Retrieves a monitor alert by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .output(monitorAlertPresenter)
      .do(async ctx => monitorAlertPresenter.present({ alert: ctx.alert })),

    viewed: instanceGroup
      .post(instancePath('monitor-alerts/:monitorAlertId/viewed', 'monitorAlerts.viewed'), {
        name: 'Mark monitor alert viewed',
        description: 'Marks a monitor alert as viewed by the current actor.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:write'] }))
      .output(monitorAlertPresenter)
      .do(async ctx => {
        let alert = await subspaceMonitorAlertService.viewed({
          instance: ctx.instance,
          alertId: getRequiredParam(ctx.params, 'monitorAlertId'),
          ...actorInput(ctx)
        });

        return monitorAlertPresenter.present({ alert });
      }),

    resolve: instanceGroup
      .post(instancePath('monitor-alerts/:monitorAlertId/resolve', 'monitorAlerts.resolve'), {
        name: 'Resolve monitor alert',
        description: 'Marks a monitor alert as resolved.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:write'] }))
      .output(monitorAlertPresenter)
      .do(async ctx => {
        let alert = await subspaceMonitorAlertService.resolve({
          instance: ctx.instance,
          alertId: getRequiredParam(ctx.params, 'monitorAlertId'),
          ...actorInput(ctx)
        });

        return monitorAlertPresenter.present({ alert });
      }),

    unresolve: instanceGroup
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
        let alert = await subspaceMonitorAlertService.unresolve({
          instance: ctx.instance,
          alertId: getRequiredParam(ctx.params, 'monitorAlertId'),
          ...actorInput(ctx)
        });

        return monitorAlertPresenter.present({ alert });
      })
  }
);
