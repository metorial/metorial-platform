import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackService } from '@metorial-subspace/module-callback';
import { callbackTriggerSelectionOptionPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { getOwnershipActor } from '../../../lib/ownershipActor';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';

export let callbackTriggerSelectionOptionController = Controller.create(
  {
    name: 'Callback Trigger Selection Options',
    description:
      'The values a connected account can pick for a field of a trigger group selection.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/instances/:instanceId/callback-trigger-selection-options',
          'dashboard.instance.callbackTriggerSelectionOptions.list'
        ),
        {
          name: 'List callback trigger selection options',
          description:
            'Returns a paginated list of the values a connected account can pick for one field of a trigger group selection, such as its folders. Only connections the caller may use are considered. The provider decides the page size, so `limit` is not applied, and the list can only be paged forward with `after`.',
          hideInDocs: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .use(hasFlags(['callbacks-enabled']))
      .query(
        'default',
        Paginator.validate(
          v.object({
            callback_id: v.string({
              description: 'Callback the trigger group belongs to',
              examples: ['cb_5eFgHjKlMnPqRsTu']
            }),
            trigger_group_key: v.string({
              description: 'Key of the trigger group the field belongs to',
              examples: ['folder_events']
            }),
            field: v.string({
              description: 'Selection field to list options for',
              examples: ['folderIds']
            }),
            callback_instance_id: v.optional(
              v.string({
                description:
                  'Callback instance whose connected account is used to list the options. Defaults to the most recently created one whose connection the caller may use.',
                examples: ['cbi_5eFgHjKlMnPqRsTu']
              })
            ),
            search: v.optional(
              v.string({
                description: 'Search text to narrow the options',
                examples: ['invoices']
              })
            )
          })
        )
      )
      .outputList(callbackTriggerSelectionOptionPresenter)
      .do(async ctx => {
        let callback = await callbackService.getCallbackById({
          instance: ctx.instance,
          callbackId: ctx.query.callback_id,
          allowDeleted: false
        });

        let paginator = await callbackService.listTriggerSelectionOptions({
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          callback,
          input: {
            triggerGroupKey: ctx.query.trigger_group_key,
            field: ctx.query.field,
            callbackInstanceId: ctx.query.callback_instance_id,
            search: ctx.query.search
          }
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, triggerSelectionOption =>
          callbackTriggerSelectionOptionPresenter.present({ triggerSelectionOption })
        );
      })
  }
);
