import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerAccessRequestService, consumerGroupService } from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { consumerAccessRequestPresenter } from '../../presenters';
import { portalGroup } from './portal';

let portalConsumerAccessRequestGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerAccessRequestId) {
    throw new ServiceError(
      badRequestError({
        message: 'consumerAccessRequestId is required',
        description: 'The consumerAccessRequestId path parameter is required.'
      })
    );
  }

  let consumerAccessRequest = await consumerAccessRequestService.getConsumerAccessRequestById({
    consumerSurface: ctx.portal.surface,
    consumerAccessRequestId: ctx.params.consumerAccessRequestId
  });

  return { consumerAccessRequest };
});

export let portalConsumerAccessRequestController = Controller.create(
  {
    name: 'Portal Consumer Access Requests',
    description: 'Review and resolve consumer access requests for a portal.',
    hideInDocs: true
  },
  {
    list: portalGroup
      .get(instancePath('portals/:portalId/access-requests', 'portals.accessRequests.list'), {
        name: 'List portal consumer access requests',
        description: 'Returns a paginated list of consumer access requests for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['pending', 'approved', 'rejected']),
                v.array(v.enumOf(['pending', 'approved', 'rejected']))
              ])
            ),
            consumer_profile_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .outputList(consumerAccessRequestPresenter)
      .do(async ctx => {
        let paginator = await consumerAccessRequestService.listConsumerAccessRequests({
          consumerSurface: ctx.portal.surface,
          statuses: normalizeArrayParam(ctx.query.status),
          consumerProfileIds: normalizeArrayParam(ctx.query.consumer_profile_id)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerAccessRequest =>
          consumerAccessRequestPresenter.present({ consumerAccessRequest })
        );
      }),

    get: portalConsumerAccessRequestGroup
      .get(
        instancePath(
          'portals/:portalId/access-requests/:consumerAccessRequestId',
          'portals.accessRequests.get'
        ),
        {
          name: 'Get portal consumer access request',
          description: 'Retrieves a consumer access request by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerAccessRequestPresenter)
      .do(async ctx => {
        return consumerAccessRequestPresenter.present({
          consumerAccessRequest: ctx.consumerAccessRequest
        });
      }),

    review: portalConsumerAccessRequestGroup
      .patch(
        instancePath(
          'portals/:portalId/access-requests/:consumerAccessRequestId',
          'portals.accessRequests.update'
        ),
        {
          name: 'Review portal consumer access request',
          description: 'Approves or rejects a consumer access request.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          status: v.enumOf(['approved', 'rejected']),
          resolution_message: v.optional(v.string()),
          consumer_group_id: v.optional(v.string())
        })
      )
      .output(consumerAccessRequestPresenter)
      .do(async ctx => {
        let consumerGroup =
          ctx.body.status == 'approved' && ctx.body.consumer_group_id
            ? await consumerGroupService.getConsumerGroupById({
                consumerSurface: ctx.portal.surface,
                consumerGroupId: ctx.body.consumer_group_id,
                types: ['default', 'user_access']
              })
            : undefined;

        let consumerAccessRequest =
          await consumerAccessRequestService.reviewConsumerAccessRequest({
            organization: ctx.organization,
            consumerAccessRequest: ctx.consumerAccessRequest,
            input: {
              status: ctx.body.status,
              resolutionMessage: ctx.body.resolution_message,
              consumerGroup
            }
          });

        return consumerAccessRequestPresenter.present({
          consumerAccessRequest
        });
      })
  }
);
