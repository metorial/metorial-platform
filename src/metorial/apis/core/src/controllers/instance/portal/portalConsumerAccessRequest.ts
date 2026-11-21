import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerAccessRequestService } from '@metorial/module-consumer-access';
import { consumerGroupService } from '@metorial/module-consumer-core';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';
import { consumerAccessRequestPresenter } from '@metorial/presenters';
import { portalGroup } from './portal';

let portalConsumerAccessRequestGroup = portalGroup.use(async ctx => {
  if (!ctx.params.accessRequestId) {
    throw new ServiceError(
      badRequestError({
        message: 'accessRequestId is required',
        description: 'The accessRequestId path parameter is required.'
      })
    );
  }

  let consumerAccessRequest = await consumerAccessRequestService.getConsumerAccessRequestById({
    consumerSurface: ctx.portal.surface,
    consumerAccessRequestId: ctx.params.accessRequestId
  });

  return { consumerAccessRequest };
});

export let portalConsumerAccessRequestController = Controller.create(
  {
    name: 'Portal Access Requests',
    description:
      "A portal access request is a consumer's request for access to a listing. Approving it grants access through a consumer group."
  },
  {
    list: portalGroup
      .get(instancePath('portals/:portalId/access-requests', 'portals.accessRequests.list'), {
        name: 'List portal access requests',
        description: 'Returns a paginated list of access requests for a portal.'
      })
      .use(requireNonPublishableMachineAccess())
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
              ]),
              { description: 'Only return requests with one of these statuses.' }
            ),
            consumer_profile_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Only return requests from these consumer profiles.' }
            ),
            search: v.optional(v.string({ description: 'Search by name or description.' }))
          })
        )
      )
      .outputList(consumerAccessRequestPresenter)
      .do(async ctx => {
        let paginator = await consumerAccessRequestService.listConsumerAccessRequests({
          consumerSurface: ctx.portal.surface,
          statuses: normalizeArrayParam(ctx.query.status),
          consumerProfileIds: normalizeArrayParam(ctx.query.consumer_profile_id),
          search: ctx.query.search
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerAccessRequest =>
          consumerAccessRequestPresenter.present({ consumerAccessRequest })
        );
      }),

    get: portalConsumerAccessRequestGroup
      .get(
        instancePath(
          'portals/:portalId/access-requests/:accessRequestId',
          'portals.accessRequests.get'
        ),
        {
          name: 'Get portal access request',
          description: 'Retrieves a portal access request.'
        }
      )
      .use(requireNonPublishableMachineAccess())
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
          'portals/:portalId/access-requests/:accessRequestId',
          'portals.accessRequests.update'
        ),
        {
          name: 'Review portal access request',
          description:
            'Approves or rejects a portal access request. Approving with a consumer group grants access through that group.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          status: v.enumOf(['approved', 'rejected'], {
            description: 'Whether to approve or reject the request.'
          }),
          resolution_message: v.optional(
            v.string({ description: 'Message shown to the consumer about the decision.' })
          ),
          consumer_group_id: v.optional(
            v.string({ description: 'Consumer group the approval grants access through.' })
          )
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
            auditScope: ctx.auditScope,
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
