import { consumerSurfaceMagicMcpAccessService } from '@metorial/module-consumer';
import { magicMcpGroupService } from '@metorial/module-magic';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { magicMcpGroupPresenter } from '../../presenters';
import { portalGroup } from './portal';

export let magicMcpAccessGroup = portalGroup.use(async ctx => {
  if (!ctx.params.magicMcpAccessId) throw new Error('magicMcpAccessId is required');

  let magicMcpAccess =
    await consumerSurfaceMagicMcpAccessService.getConsumerSurfaceMagicMcpAccessById({
      consumerSurface: ctx.portal.surface,
      groupId: ctx.params.magicMcpAccessId
    });

  return { magicMcpAccess };
});

export let portalMagicMcpAccessController = Controller.create(
  {
    name: 'Portal Magic MCP Access',
    description: 'Connect Magic MCP Groups to Portals to control access to your marketplaces.'
  },
  {
    list: portalGroup
      .get(
        instancePath('portals/:portalId/magic-mcp-access/:magicMcpAccessId', 'portals.list'),
        {
          name: 'List Portal',
          description: 'Returns a paginated list of portals.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal:read', 'instance.server.deployment:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .outputList(magicMcpGroupPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator =
          await consumerSurfaceMagicMcpAccessService.listConsumerSurfaceMagicMcpAccesses({
            consumerSurface: ctx.portal.surface
          });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, access =>
          magicMcpGroupPresenter.present({ magicMcpGroup: access.magicMcpGroup })
        );
      }),

    get: magicMcpAccessGroup
      .get(
        instancePath('portals/:portalId/magic-mcp-access/:magicMcpAccessId', 'portals.get'),
        {
          name: 'Get SSO Tenant by ID',
          description: 'Retrieves details for a specific portal by its ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal:read', 'instance.server.deployment:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(magicMcpGroupPresenter)
      .do(async ctx => {
        return magicMcpGroupPresenter.present({
          magicMcpGroup: ctx.magicMcpAccess.magicMcpGroup
        });
      }),

    create: magicMcpAccessGroup
      .post(
        instancePath('portals/:portalId/magic-mcp-access/:magicMcpAccessId', 'portals.create'),
        {
          name: 'Create SSO Tenant',
          description: 'Creates a new sso tenant for the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal:write', 'instance.server.deployment:read']
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
      .output(magicMcpGroupPresenter)
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.getMagicMcpGroupById({
          consumerSurface: ctx.portal.surface,
          instance: ctx.instance,
          magicMcpGroupId: ctx.input.name
        });

        let access =
          await consumerSurfaceMagicMcpAccessService.createConsumerSurfaceMagicMcpAccess({
            consumerSurface: ctx.portal.surface,
            magicMcpGroup
          });

        return magicMcpGroupPresenter.present({ magicMcpGroup: access.magicMcpGroup });
      }),

    delete: magicMcpAccessGroup
      .delete(
        instancePath('portals/:portalId/magic-mcp-access/:magicMcpAccessId', 'portals.delete'),
        {
          name: 'Delete Portal',
          description: 'Deletes a portal from the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal:write', 'instance.server.deployment:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(magicMcpGroupPresenter)
      .do(async ctx => {
        let access =
          await consumerSurfaceMagicMcpAccessService.deleteConsumerSurfaceMagicMcpAccess({
            groupAccess: ctx.magicMcpAccess
          });

        return magicMcpGroupPresenter.present({ magicMcpGroup: access.magicMcpGroup });
      })
  }
);
