import { consumerAccessService, consumerGroupService } from '@metorial/module-consumer';
import { magicMcpGroupService } from '@metorial/module-magic';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { consumerAccessPresenter } from '../../presenters';
import { portalGroup } from './portal';

export let consumerAccessGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerAccessId) throw new Error('consumerAccessId is required');

  let consumerAccess = await consumerAccessService.getConsumerAccessById({
    consumerSurface: ctx.portal.surface,
    accessId: ctx.params.consumerAccessId
  });

  return { consumerAccess };
});

export let portalConsumerAccessController = Controller.create(
  {
    name: 'Portal Consumer Access',
    description: 'Connect Consumer Groups to Portals to control access to your marketplaces.'
  },
  {
    list: portalGroup
      .get(instancePath('portals/:portalId/consumer-access', 'portals.consumerAccess.list'), {
        name: 'List Portal',
        description: 'Returns a paginated list of portals.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .outputList(consumerAccessPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await consumerAccessService.listConsumerAccesses({
          consumerSurface: ctx.portal.surface
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerAccess =>
          consumerAccessPresenter.present({ consumerAccess })
        );
      }),

    get: consumerAccessGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-access/:consumerAccessId',
          'portals.consumerAccess.get'
        ),
        {
          name: 'Get Consumer Access by ID',
          description: 'Retrieves details for a specific portal by its ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(consumerAccessPresenter)
      .do(async ctx => {
        return consumerAccessPresenter.present({
          consumerAccess: ctx.consumerAccess
        });
      }),

    create: consumerAccessGroup
      .post(
        instancePath('portals/:portalId/consumer-access', 'portals.consumerAccess.create'),
        {
          name: 'Create Consumer Access',
          description: 'Creates a new sso tenant for the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          consumer_group_id: v.string(),

          access: v.object({
            type: v.literal('magic_mcp_group'),
            magic_mcp_group_id: v.string()
          })
        })
      )
      .output(consumerAccessPresenter)
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.getMagicMcpGroupById({
          consumerSurface: ctx.portal.surface,
          instance: ctx.instance,
          magicMcpGroupId: ctx.body.access.magic_mcp_group_id
        });

        let consumerGroup = await consumerGroupService.getConsumerGroupById({
          consumerSurface: ctx.portal.surface,
          consumerGroupId: ctx.body.consumer_group_id
        });

        let consumerAccess = await consumerAccessService.createConsumerAccess({
          consumerSurface: ctx.portal.surface,
          consumerGroup,
          access: {
            type: 'magic_mcp_group',
            magicMcpGroup
          }
        });

        return consumerAccessPresenter.present({ consumerAccess });
      }),

    delete: consumerAccessGroup
      .delete(
        instancePath(
          'portals/:portalId/consumer-access/:consumerAccessId',
          'portals.consumerAccess.delete'
        ),
        {
          name: 'Delete Portal',
          description: 'Deletes a portal from the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(consumerAccessPresenter)
      .do(async ctx => {
        let consumerAccess = await consumerAccessService.deleteConsumerAccess({
          groupAccess: ctx.consumerAccess
        });

        return consumerAccessPresenter.present({ consumerAccess });
      })
  }
);
