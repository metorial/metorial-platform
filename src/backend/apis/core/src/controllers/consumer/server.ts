import { serverService } from '@metorial/module-catalog';
import { consumerServerRequestService } from '@metorial/module-consumer';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import { consumerServerRequestPresenter } from '../../presenters';

export let consumerServerController = Controller.create(
  {
    name: 'Consumer Session',
    description: '',
    hideInDocs: true
  },
  {
    requestServer: consumerGroup
      .post(consumerPath('server-requests', 'serverRequests.create'), {
        name: '',
        description: ''
      })
      .output(consumerServerRequestPresenter)
      .body(
        'default',
        v.object({
          server_id: v.string(),
          reason: v.string()
        })
      )
      .do(async ctx => {
        let server = await serverService.getServerById({
          serverId: ctx.body.server_id,
          organization: ctx.organization
        });

        let consumerServerRequest =
          await consumerServerRequestService.createConsumerServerRequest({
            consumerSurface: ctx.consumerSurface,
            consumerProfile: ctx.consumerProfile,
            server,
            input: {
              reason: ctx.body.reason
            }
          });

        return consumerServerRequestPresenter.present({
          consumerServerRequest
        });
      }),

    list: consumerGroup
      .get(consumerPath('server-requests', 'serverRequests.list'), {
        name: '',
        description: ''
      })
      .outputList(consumerServerRequestPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            server_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerServerRequestService.listConsumerServerRequests({
          consumerSurface: ctx.consumerSurface,
          consumerProfileIds: [ctx.consumerProfile.id],
          serverIds: normalizeArrayParam(ctx.query.server_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerServerRequest =>
          consumerServerRequestPresenter.present({
            consumerServerRequest
          })
        );
      }),

    get: consumerGroup
      .get(consumerPath('server-requests/:consumerServerRequestId', 'serverRequests.get'), {
        name: '',
        description: ''
      })
      .output(consumerServerRequestPresenter)
      .do(async ctx => {
        let consumerServerRequest =
          await consumerServerRequestService.getConsumerServerRequestById({
            consumerSurface: ctx.consumerSurface,
            consumerServerRequestId: ctx.params.consumerServerRequestId,
            consumerProfile: ctx.consumerProfile
          });

        return consumerServerRequestPresenter.present({
          consumerServerRequest
        });
      })
  }
);
