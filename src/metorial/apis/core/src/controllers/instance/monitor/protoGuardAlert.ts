import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { protoGuardAlertService } from '@metorial-subspace/module-monitor';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { protoGuardAlertPresenter } from '@metorial/presenters';
import { getRequiredParam, stringOrArray } from './_shared';

let protoGuardAlertGroup = integrationsGroup.use(async ctx => {
  let alert = await protoGuardAlertService.getAlertById({
    instance: ctx.instance,
    alertId: getRequiredParam(ctx.params, 'protoGuardAlertId')
  });

  return { alert };
});

export let protoGuardAlertController = Controller.create(
  {
    name: 'ProtoGuard Alerts',
    description:
      'A ProtoGuard alert is a record of related prompt-injection findings. Findings that recur are folded into the same alert.'
  },
  {
    list: integrationsGroup
      .get(instancePath('protoguard-alerts', 'protoGuardAlerts.list'), {
        name: 'List ProtoGuard alerts',
        description: 'Returns a paginated list of ProtoGuard alerts in the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .outputList(protoGuardAlertPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray(), {
              description: 'Only return ProtoGuard alerts with one of these IDs.'
            }),
            run_id: v.optional(stringOrArray(), {
              description: 'Only return ProtoGuard alerts from one of these runs.'
            }),
            filter_id: v.optional(stringOrArray(), {
              description: 'Only return ProtoGuard alerts matching one of these filters.'
            }),
            session_id: v.optional(stringOrArray(), {
              description: 'Only return ProtoGuard alerts linked to one of these sessions.'
            }),
            session_message_id: v.optional(stringOrArray(), {
              description:
                'Only return ProtoGuard alerts linked to one of these session messages.'
            }),
            session_connection_id: v.optional(stringOrArray(), {
              description:
                'Only return ProtoGuard alerts linked to one of these session connections.'
            }),
            provider_run_id: v.optional(stringOrArray(), {
              description:
                'Only return ProtoGuard alerts linked to one of these provider runs.'
            }),
            issue_id: v.optional(stringOrArray(), {
              description: 'Only return ProtoGuard alerts folded into one of these issues.'
            }),
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
          issueIds: normalizeArrayParam(ctx.query.issue_id),
          createdAt: ctx.query.created_at
        });

        return Paginator.present(await paginator.run(ctx.query), alert =>
          protoGuardAlertPresenter.present({ alert })
        );
      }),

    get: protoGuardAlertGroup
      .get(instancePath('protoguard-alerts/:protoGuardAlertId', 'protoGuardAlerts.get'), {
        name: 'Get ProtoGuard alert',
        description: 'Retrieves a ProtoGuard alert.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .output(protoGuardAlertPresenter)
      .do(async ctx => protoGuardAlertPresenter.present({ alert: ctx.alert }))
  }
);
