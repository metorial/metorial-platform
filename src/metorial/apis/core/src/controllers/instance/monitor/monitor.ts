import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { monitorService } from '@metorial-subspace/module-monitor';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { monitorPresenter } from '@metorial/presenters';
import {
  getRequiredParam,
  monitorStatusValidator,
  monitorTargetValidator,
  stringOrArray
} from './_shared';

let monitorGroup = instanceGroup.use(async ctx => {
  let monitor = await monitorService.getMonitorById({
    instance: ctx.instance,
    monitorId: getRequiredParam(ctx.params, 'monitorId')
  });

  return { monitor };
});

export let monitorController = Controller.create(
  {
    name: 'Monitors',
    description: 'Monitors track automated observability checks for this instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('monitors', 'monitors.list'), {
        name: 'List monitors',
        description: 'Returns a paginated list of monitors for this instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .outputList(monitorPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray(), { description: 'Filter by monitor ID(s)' }),
            target: v.optional(
              v.union([monitorTargetValidator, v.array(monitorTargetValidator)])
            ),
            status: v.optional(
              v.union([monitorStatusValidator, v.array(monitorStatusValidator)])
            ),
            provider_id: v.optional(stringOrArray()),
            proto_guard_filter_id: v.optional(stringOrArray()),
            search: v.optional(v.string()),
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
        description: 'Retrieves a monitor by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .output(monitorPresenter)
      .do(async ctx => monitorPresenter.present({ monitor: ctx.monitor }))
  }
);
