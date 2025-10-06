import { MagicMcpServerStatus } from '@metorial/db';
import { magicMcpServerService } from '@metorial/module-magic';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { magicMcpServerPresenter } from '../../presenters';
import { createServerDeployment, createServerDeploymentSchema } from './serverDeployment';

export let magicMcpServerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpServerId) throw new Error('magicMcpServerId is required');

  let magicMcpServer = await magicMcpServerService.getMagicMcpServerById({
    magicMcpServerId: ctx.params.magicMcpServerId,
    instance: ctx.instance
  });

  return { magicMcpServer };
});

export let magicMcpServerController = Controller.create(
  {
    name: 'Magic MCP Server',
    description:
      'Before you can connect to an MCP server, you need to create a magic MCP server.'
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-servers', 'magicMcpServers.list'), {
        name: 'List magic MCP server',
        description: 'List all magic MCP server'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:read'] }))
      .outputList(magicMcpServerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(MagicMcpServerStatus) as any),
                v.array(v.enumOf(Object.keys(MagicMcpServerStatus) as any))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await magicMcpServerService.listMagicMcpServers({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpServer =>
          magicMcpServerPresenter.present({ magicMcpServer })
        );
      }),

    get: magicMcpServerGroup
      .get(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.get'), {
        name: 'Get magic MCP server',
        description: 'Get the information of a specific magic MCP server'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:read'] }))
      .output(magicMcpServerPresenter)
      .do(async ctx => {
        return magicMcpServerPresenter.present({ magicMcpServer: ctx.magicMcpServer });
      }),

    create: instanceGroup
      .post(instancePath('magic-mcp-servers', 'magicMcpServers.create'), {
        name: 'Create magic MCP server',
        description: 'Create a new magic MCP server'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .body('default', createServerDeploymentSchema)
      .output(magicMcpServerPresenter)
      .do(async ctx => {
        let serverDeployment = await createServerDeployment(
          ctx.body,
          {
            instance: ctx.instance,
            organization: ctx.organization,
            actor: ctx.actor,
            context: ctx.context
          },
          { type: 'ephemeral' }
        );

        let magicMcpServer = await magicMcpServerService.createMagicMcpServer({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          context: ctx.context,
          serverDeployment,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return magicMcpServerPresenter.present({ magicMcpServer });
      }),

    delete: magicMcpServerGroup
      .delete(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.delete'), {
        name: 'Delete magic MCP server',
        description: 'Delete a specific magic MCP server'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .output(magicMcpServerPresenter)
      .do(async ctx => {
        let magicMcpServer = await magicMcpServerService.archiveMagicMcpServer({
          server: ctx.magicMcpServer
        });

        return magicMcpServerPresenter.present({ magicMcpServer });
      }),

    update: magicMcpServerGroup
      .patch(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.update'), {
        name: 'Update magic MCP server',
        description: 'Update the information of a specific magic MCP server'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'The name of the magic MCP server' })),
          description: v.optional(
            v.string({ description: 'The description of the magic MCP server' })
          ),
          metadata: v.optional(
            v.record(v.any(), { description: 'The metadata of the magic MCP server' })
          ),
          aliases: v.optional(
            v.array(v.string({ description: 'The alias (slug) of the magic MCP server' }))
          )
        })
      )
      .output(magicMcpServerPresenter)
      .do(async ctx => {
        let magicMcpServer = await magicMcpServerService.updateMagicMcpServer({
          server: ctx.magicMcpServer,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            aliases: ctx.body.aliases
          }
        });

        return magicMcpServerPresenter.present({ magicMcpServer });
      })
  }
);
