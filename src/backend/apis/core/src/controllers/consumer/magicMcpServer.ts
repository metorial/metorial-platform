import { magicMcpServerService } from '@metorial/module-magic';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import { hasFlags } from '../../middleware/hasFlags';
import { magicMcpServerPresenter } from '../../presenters';

export let consumerMagicMcpServerGroup = consumerGroup.use(async ctx => {
  if (!ctx.params.magicMcpServerId) throw new Error('magicMcpServerId is required');

  let magicMcpServer = await magicMcpServerService.getMagicMcpServerById({
    magicMcpServerId: ctx.params.magicMcpServerId,
    instance: ctx.instance,
    consumerProfile: ctx.consumerProfile
  });

  return { magicMcpServer };
});

export let consumerMagicMcpServerController = Controller.create(
  {
    name: 'Consumer Magic MCP Server',
    description:
      'Before you can connect to an MCP server, you need to create a magic MCP server.',
    hideInDocs: true
  },
  {
    list: consumerGroup
      .get(consumerPath('magic-mcp-servers', 'magicMcpServers.list'), {
        name: 'List magic MCP server',
        description: 'List all magic MCP server'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:read'] }))
      .outputList(magicMcpServerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            server_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_variant_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_implementation_id: v.optional(v.union([v.string(), v.array(v.string())])),
            magic_mcp_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            search: v.optional(v.string())
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpServerService.listMagicMcpServers({
          instance: ctx.instance,
          serverIds: normalizeArrayParam(ctx.query.server_id),
          serverVariantIds: normalizeArrayParam(ctx.query.server_variant_id),
          serverImplementationIds: normalizeArrayParam(ctx.query.server_implementation_id),
          groupIds: normalizeArrayParam(ctx.query.magic_mcp_group_id),
          search: ctx.query.search,
          status: ['active']
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpServer =>
          magicMcpServerPresenter.present({ magicMcpServer })
        );
      }),

    get: consumerMagicMcpServerGroup
      .get(consumerPath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.get'), {
        name: 'Get magic MCP server',
        description: 'Get the information of a specific magic MCP server'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:read'] }))
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpServerPresenter.present({ magicMcpServer: ctx.magicMcpServer });
      })
  }
);
