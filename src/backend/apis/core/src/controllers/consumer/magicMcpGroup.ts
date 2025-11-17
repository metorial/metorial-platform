import { MagicMcpGroupStatus } from '@metorial/db';
import { magicMcpGroupService } from '@metorial/module-magic';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import { hasFlags } from '../../middleware/hasFlags';
import { magicMcpGroupPresenter } from '../../presenters';

export let consumerMagicMcpGroupGroup = consumerGroup.use(async ctx => {
  if (!ctx.params.magicMcpGroupId) throw new Error('magicMcpGroupId is required');

  let magicMcpGroup = await magicMcpGroupService.getMagicMcpGroupById({
    magicMcpGroupId: ctx.params.magicMcpGroupId,
    instance: ctx.instance,
    consumerProfile: ctx.consumerProfile
  });

  return { magicMcpGroup };
});

export let consumerMagicMcpGroupController = Controller.create(
  {
    name: 'Consumer Magic MCP Group',
    description:
      'Before you can connect to an MCP server, you need to create a magic MCP group.',
    hideInDocs: true
  },
  {
    list: consumerGroup
      .get(consumerPath('magic-mcp-groups', 'magicMcpGroups.list'), {
        name: 'List magic MCP group',
        description: 'List all magic MCP group'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:read'] }))
      .outputList(magicMcpGroupPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(MagicMcpGroupStatus) as any),
                v.array(v.enumOf(Object.keys(MagicMcpGroupStatus) as any))
              ])
            ),
            search: v.optional(v.string())
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpGroupService.listMagicMcpGroups({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any,
          search: ctx.query.search,
          consumerProfile: ctx.consumerProfile
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpGroup =>
          magicMcpGroupPresenter.present({ magicMcpGroup })
        );
      }),

    get: consumerMagicMcpGroupGroup
      .get(consumerPath('magic-mcp-groups/:magicMcpGroupId', 'magicMcpGroups.get'), {
        name: 'Get magic MCP group',
        description: 'Get the information of a specific magic MCP group'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:read'] }))
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpGroupPresenter.present({ magicMcpGroup: ctx.magicMcpGroup });
      })
  }
);
