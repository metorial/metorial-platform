import { MagicMcpGroupStatus } from '@metorial/db';
import { magicMcpGroupService } from '@metorial/module-magic';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { magicMcpGroupPresenter } from '../../presenters';

export let magicMcpGroupGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpGroupId) throw new Error('magicMcpGroupId is required');

  let magicMcpGroup = await magicMcpGroupService.getMagicMcpGroupById({
    magicMcpGroupId: ctx.params.magicMcpGroupId,
    instance: ctx.instance
  });

  return { magicMcpGroup };
});

export let magicMcpGroupController = Controller.create(
  {
    name: 'Magic MCP Group',
    description:
      'Before you can connect to an MCP server, you need to create a magic MCP group.'
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-groups', 'magicMcpGroups.list'), {
        name: 'List magic MCP group',
        description: 'List all magic MCP group'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:read'] }))
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
            )
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpGroupService.listMagicMcpGroups({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpGroup =>
          magicMcpGroupPresenter.present({ magicMcpGroup })
        );
      }),

    get: magicMcpGroupGroup
      .get(instancePath('magic-mcp-groups/:magicMcpGroupId', 'magicMcpGroups.get'), {
        name: 'Get magic MCP group',
        description: 'Get the information of a specific magic MCP group'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:read'] }))
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpGroupPresenter.present({ magicMcpGroup: ctx.magicMcpGroup });
      }),

    create: instanceGroup
      .post(instancePath('magic-mcp-groups', 'magicMcpGroups.create'), {
        name: 'Create magic MCP group',
        description: 'Create a new magic MCP group'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ description: 'The name of the magic MCP group' }),
          description: v.optional(
            v.string({ description: 'The description of the magic MCP group' })
          ),
          metadata: v.optional(
            v.record(v.any(), { description: 'The metadata of the magic MCP group' })
          )
        })
      )
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.createMagicMcpGroup({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      }),

    delete: magicMcpGroupGroup
      .delete(instancePath('magic-mcp-groups/:magicMcpGroupId', 'magicMcpGroups.delete'), {
        name: 'Delete magic MCP group',
        description: 'Delete a specific magic MCP group'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.deleteMagicMcpGroup({
          group: ctx.magicMcpGroup
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      }),

    update: magicMcpGroupGroup
      .patch(instancePath('magic-mcp-groups/:magicMcpGroupId', 'magicMcpGroups.update'), {
        name: 'Update magic MCP group',
        description: 'Update the information of a specific magic MCP group'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'The name of the magic MCP group' })),
          description: v.optional(
            v.string({ description: 'The description of the magic MCP group' })
          ),
          metadata: v.optional(
            v.record(v.any(), { description: 'The metadata of the magic MCP group' })
          )
        })
      )
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.updateMagicMcpGroup({
          group: ctx.magicMcpGroup,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      }),

    addServers: magicMcpGroupGroup
      .post(
        instancePath('magic-mcp-groups/:magicMcpGroupId/servers', 'magicMcpGroups.addServers'),
        {
          name: 'Add servers to magic MCP group',
          description: 'Add magic MCP servers to a specific magic MCP group'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .body(
        'default',
        v.object({
          magic_mcp_server_ids: v.array(v.string(), {
            description: 'The IDs of the magic MCP servers to add to the group'
          })
        })
      )
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.addServersToGroup({
          group: ctx.magicMcpGroup,
          serverIds: ctx.body.magic_mcp_server_ids
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      }),

    removeServers: magicMcpGroupGroup
      .delete(
        instancePath(
          'magic-mcp-groups/:magicMcpGroupId/servers',
          'magicMcpGroups.removeServers'
        ),
        {
          name: 'Remove servers from magic MCP group',
          description: 'Remove magic MCP servers from a specific magic MCP group'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.deployment:write'] }))
      .body(
        'default',
        v.object({
          magic_mcp_server_ids: v.array(v.string(), {
            description: 'The IDs of the magic MCP servers to remove from the group'
          })
        })
      )
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.removeServersFromGroup({
          group: ctx.magicMcpGroup,
          serverIds: ctx.body.magic_mcp_server_ids
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      })
  }
);
