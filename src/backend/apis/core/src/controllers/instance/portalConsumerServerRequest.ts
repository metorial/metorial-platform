import { ConsumerServerRequestStatus } from '@metorial/db';
import { consumerServerRequestService } from '@metorial/module-consumer';
import { serverDeploymentTemplateService } from '@metorial/module-server-deployment';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { consumerServerRequestPresenter } from '../../presenters';
import { portalGroup } from './portal';

export let consumerServerRequestGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerServerRequestId)
    throw new Error('consumerServerRequestId is required');

  let consumerServerRequest = await consumerServerRequestService.getConsumerServerRequestById({
    consumerSurface: ctx.portal.surface,
    consumerServerRequestId: ctx.params.consumerServerRequestId
  });

  return { consumerServerRequest };
});

export let portalConsumerServerRequestController = Controller.create(
  {
    name: 'Portal Consumer Server Requests',
    description: 'Connect Magic MCP Groups to Portals to control access to your marketplaces.'
  },
  {
    list: portalGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-server-requests',
          'portals.consumerServerRequests.list'
        ),
        {
          name: 'List Portal',
          description: 'Returns a paginated list of portals.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.server_requests:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .outputList(consumerServerRequestPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(ConsumerServerRequestStatus) as any),
                v.array(v.enumOf(Object.keys(ConsumerServerRequestStatus) as any))
              ])
            ),

            server_id: v.optional(v.union([v.string(), v.array(v.string())])),
            consumer_profile_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerServerRequestService.listConsumerServerRequests({
          consumerSurface: ctx.portal.surface,
          status: normalizeArrayParam(ctx.query.status) as any[],
          consumerProfileIds: normalizeArrayParam(ctx.query.consumer_profile_id),
          serverIds: normalizeArrayParam(ctx.query.server_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerServerRequest =>
          consumerServerRequestPresenter.present({
            consumerServerRequest
          })
        );
      }),

    get: consumerServerRequestGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-server-requests/:consumerServerRequestId',
          'portals.consumerServerRequests.get'
        ),
        {
          name: 'Get Portal Consumer Server Request by ID',
          description: 'Retrieves details for a specific portal by its ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.server_requests:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(consumerServerRequestPresenter)
      .do(async ctx => {
        return consumerServerRequestPresenter.present({
          consumerServerRequest: ctx.consumerServerRequest
        });
      }),

    accept: consumerServerRequestGroup
      .post(
        instancePath(
          'portals/:portalId/consumer-server-requests/:consumerServerRequestId/accept',
          'portals.consumerServerRequests.accept'
        ),
        {
          name: 'Create Portal Consumer Server Request',
          description: 'Creates a new sso tenant for the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.server_requests:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          server_deployment_template_id: v.string({
            name: 'server_deployment_template_id',
            description:
              'The ID of the server deployment template to use for the server request'
          })
        })
      )
      .output(consumerServerRequestPresenter)
      .do(async ctx => {
        let serverDeploymentTemplate =
          await serverDeploymentTemplateService.getServerDeploymentTemplateById({
            instance: ctx.instance,
            serverDeploymentTemplateId: ctx.body.server_deployment_template_id
          });

        let consumerServerRequest =
          await consumerServerRequestService.acceptConsumerServerRequest({
            consumerServerRequest: ctx.consumerServerRequest,
            serverDeploymentTemplate
          });

        return consumerServerRequestPresenter.present({ consumerServerRequest });
      }),

    reject: consumerServerRequestGroup
      .post(
        instancePath(
          'portals/:portalId/consumer-server-requests/:consumerServerRequestId/reject',
          'portals.consumerServerRequests.reject'
        ),
        {
          name: 'Reject Portal Consumer Server Request',
          description: 'Rejects a pending consumer server request.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.server_requests:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          reason: v.string({
            name: 'reason',
            description: 'The reason for rejecting the consumer server request'
          })
        })
      )
      .output(consumerServerRequestPresenter)
      .do(async ctx => {
        if (ctx.consumerServerRequest.status !== 'pending') {
          throw new Error('Only pending requests can be rejected.');
        }

        let consumerServerRequest =
          await consumerServerRequestService.rejectConsumerServerRequest({
            consumerServerRequest: ctx.consumerServerRequest,
            input: { reason: ctx.body.reason }
          });

        return consumerServerRequestPresenter.present({ consumerServerRequest });
      })
  }
);
