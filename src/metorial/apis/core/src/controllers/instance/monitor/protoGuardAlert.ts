import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { protoGuardAlertService } from '@metorial-subspace/module-monitor';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { protoGuardAlertPresenter } from '@metorial/presenters';
import { getRequiredParam, stringOrArray } from './_shared';

let protoGuardAlertGroup = instanceGroup.use(async ctx => {
  let alert = await protoGuardAlertService.getAlertById({
    instance: ctx.instance,
    alertId: getRequiredParam(ctx.params, 'protoGuardAlertId')
  });

  return { alert };
});

export let protoGuardAlertController = Controller.create(
  {
    name: 'ProtoGuard Alerts',
    description: 'ProtoGuard alerts describe prompt-injection detections.'
  },
  {
    list: instanceGroup
      .get(instancePath('protoguard-alerts', 'protoGuardAlerts.list'), {
        name: 'List ProtoGuard alerts',
        description: 'Returns a paginated list of ProtoGuard alerts for this instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .outputList(protoGuardAlertPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray()),
            run_id: v.optional(stringOrArray()),
            filter_id: v.optional(stringOrArray()),
            session_id: v.optional(stringOrArray()),
            session_message_id: v.optional(stringOrArray()),
            session_connection_id: v.optional(stringOrArray()),
            provider_run_id: v.optional(stringOrArray()),
            created_at: dateFilterValidator('ProtoGuard alert creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await protoGuardAlertService.listAlerts({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          runIds: normalizeArrayParam(ctx.query.run_id),
          filterIds: normalizeArrayParam(ctx.query.filter_id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionMessageIds: normalizeArrayParam(ctx.query.session_message_id),
          sessionConnectionIds: normalizeArrayParam(ctx.query.session_connection_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id),
          createdAt: ctx.query.created_at
        });

        return Paginator.present(await paginator.run(ctx.query), alert =>
          protoGuardAlertPresenter.present({ alert })
        );
      }),

    get: protoGuardAlertGroup
      .get(instancePath('protoguard-alerts/:protoGuardAlertId', 'protoGuardAlerts.get'), {
        name: 'Get ProtoGuard alert',
        description: 'Retrieves a ProtoGuard alert by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .output(protoGuardAlertPresenter)
      .do(async ctx => protoGuardAlertPresenter.present({ alert: ctx.alert }))
  }
);
