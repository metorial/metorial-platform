import { consumerGroupService } from '@metorial/module-consumer';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { consumerGroupPresenter } from '../../presenters';
import { portalGroup } from './portal';

export let consumerGroupGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerGroupId) throw new Error('consumerGroupId is required');

  let consumerGroup = await consumerGroupService.getConsumerGroupById({
    consumerSurface: ctx.portal.surface,
    consumerGroupId: ctx.params.consumerGroupId
  });

  return { consumerGroup };
});

export let portalConsumerGroupController = Controller.create(
  {
    name: 'Portal Consumer Groups',
    description: 'Connect Magic MCP Groups to Portals to control access to your marketplaces.'
  },
  {
    list: portalGroup
      .get(instancePath('portals/:portalId/consumer-groups', 'portals.consumerGroups.list'), {
        name: 'List Portal',
        description: 'Returns a paginated list of portals.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .outputList(consumerGroupPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await consumerGroupService.listConsumerGroups({
          consumerSurface: ctx.portal.surface
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerGroup =>
          consumerGroupPresenter.present({ consumerGroup })
        );
      }),

    get: consumerGroupGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-groups/:consumerGroupId',
          'portals.consumerGroups.get'
        ),
        {
          name: 'Get Portal Consumer Group by ID',
          description: 'Retrieves details for a specific portal by its ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(consumerGroupPresenter)
      .do(async ctx => {
        return consumerGroupPresenter.present({
          consumerGroup: ctx.consumerGroup
        });
      }),

    create: consumerGroupGroup
      .post(
        instancePath('portals/:portalId/consumer-groups', 'portals.consumerGroups.create'),
        {
          name: 'Create Portal Consumer Group',
          description: 'Creates a new sso tenant for the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string())
        })
      )
      .output(consumerGroupPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.createConsumerGroup({
          consumerSurface: ctx.portal.surface,
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          }
        });

        return consumerGroupPresenter.present({ consumerGroup });
      }),

    delete: consumerGroupGroup
      .delete(
        instancePath(
          'portals/:portalId/consumer-groups/:consumerGroupId',
          'portals.consumerGroups.delete'
        ),
        {
          name: 'Delete Portal',
          description: 'Deletes a portal from the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(consumerGroupPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.deleteConsumerGroup({
          consumerGroup: ctx.consumerGroup
        });

        return consumerGroupPresenter.present({ consumerGroup });
      })
  }
);
