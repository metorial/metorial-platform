import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { monitorService } from '@metorial-subspace/module-monitor';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { monitorPresenter } from '@metorial/presenters';
import {
  getRequiredParam,
  monitorStatusValidator,
  monitorTargetValidator,
  stringOrArray
} from './_shared';

let monitorGroup = integrationsGroup.use(async ctx => {
  let monitor = await monitorService.getMonitorById({
    instance: ctx.instance,
    monitorId: getRequiredParam(ctx.params, 'monitorId')
  });

  return { monitor };
});

export let monitorController = Controller.create(
  {
    name: 'Monitors',
    description:
      'A monitor is an automated observability check for an instance. It raises alerts when its target misbehaves.'
  },
  {
    list: integrationsGroup
      .get(instancePath('monitors', 'monitors.list'), {
        name: 'List monitors',
        description: 'Returns a paginated list of monitors in the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .outputList(monitorPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray(), {
              description: 'Only return monitors with one of these IDs.'
            }),
            target: v.optional(
              v.union([monitorTargetValidator, v.array(monitorTargetValidator)]),
              {
                description: 'Only return monitors watching one of these targets.'
              }
            ),
            status: v.optional(
              v.union([monitorStatusValidator, v.array(monitorStatusValidator)]),
              {
                description: 'Only return monitors with one of these statuses.'
              }
            ),
            provider_id: v.optional(stringOrArray(), {
              description: 'Only return monitors watching one of these providers.'
            }),
            proto_guard_filter_id: v.optional(stringOrArray(), {
              description: 'Only return monitors watching one of these ProtoGuard filters.'
            }),
            search: v.optional(
              v.string({
                description: 'Filter monitors by name or description.'
              })
            ),
            created_at: dateFilterValidator('monitor creation time'),
            updated_at: dateFilterValidator('monitor last update time'),
            first_alert_at: dateFilterValidator('first monitor alert time'),
            last_alert_at: dateFilterValidator('last monitor alert time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await monitorService.listMonitors({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          targets: normalizeArrayParam(ctx.query.target),
          statuses: normalizeArrayParam(ctx.query.status),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          protoGuardFilterIds: normalizeArrayParam(ctx.query.proto_guard_filter_id),
          search: ctx.query.search,
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at,
          firstAlertAt: ctx.query.first_alert_at,
          lastAlertAt: ctx.query.last_alert_at
        });

        return Paginator.present(await paginator.run(ctx.query), monitor =>
          monitorPresenter.present({ monitor })
        );
      }),

    get: monitorGroup
      .get(instancePath('monitors/:monitorId', 'monitors.get'), {
        name: 'Get monitor',
        description: 'Retrieves a monitor.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .output(monitorPresenter)
      .do(async ctx => monitorPresenter.present({ monitor: ctx.monitor }))
  }
);
