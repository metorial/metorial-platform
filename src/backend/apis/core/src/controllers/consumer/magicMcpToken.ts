import { MagicMcpTokenStatus } from '@metorial/db';
import { magicMcpGroupService, magicMcpTokenService } from '@metorial/module-magic';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import { hasFlags } from '../../middleware/hasFlags';
import { magicMcpTokenPresenter } from '../../presenters';

export let consumerMagicMcpTokenGroup = consumerGroup.use(async ctx => {
  if (!ctx.params.magicMcpTokenId) throw new Error('magicMcpTokenId is required');

  let magicMcpToken = await magicMcpTokenService.getMagicMcpTokenById({
    magicMcpTokenId: ctx.params.magicMcpTokenId,
    instance: ctx.instance,
    consumerProfile: ctx.consumerProfile
  });

  return { magicMcpToken };
});

export let consumerMagicMcpTokenController = Controller.create(
  {
    name: 'Consumer Magic MCP Token',
    description:
      'Before you can connect to an MCP server, you need to create a magic MCP token.'
  },
  {
    list: consumerGroup
      .get(consumerPath('magic-mcp-tokens', 'magicMcpTokens.list'), {
        name: 'List magic MCP token',
        description: 'List all magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:read'] }))
      .outputList(magicMcpTokenPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(MagicMcpTokenStatus) as any),
                v.array(v.enumOf(Object.keys(MagicMcpTokenStatus) as any))
              ])
            ),
            magic_mcp_group_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpTokenService.listMagicMcpTokens({
          instance: ctx.instance,
          groupIds: normalizeArrayParam(ctx.query.magic_mcp_group_id),
          status: normalizeArrayParam(ctx.query.status) as any,
          consumerProfile: ctx.consumerProfile
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpToken =>
          magicMcpTokenPresenter.present({ magicMcpToken })
        );
      }),

    get: consumerMagicMcpTokenGroup
      .get(consumerPath('magic-mcp-tokens/:magicMcpTokenId', 'magicMcpTokens.get'), {
        name: 'Get magic MCP token',
        description: 'Get the information of a specific magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:read'] }))
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpTokenPresenter.present({ magicMcpToken: ctx.magicMcpToken });
      }),

    create: consumerGroup
      .post(consumerPath('magic-mcp-tokens', 'magicMcpTokens.create'), {
        name: 'Create magic MCP token',
        description: 'Create a new magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ description: 'The name of the magic MCP token' }),
          description: v.optional(
            v.string({ description: 'The description of the magic MCP token' })
          ),
          metadata: v.optional(
            v.record(v.any(), { description: 'The metadata of the magic MCP token' })
          ),
          group_ids: v.optional(
            v.array(v.string(), {
              description: 'The IDs of the magic MCP groups to associate with the token'
            })
          )
        })
      )
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let groups = ctx.body.group_ids?.length
          ? await magicMcpGroupService.findManyGroupsById({
              groupIds: ctx.body.group_ids,
              instance: ctx.instance,
              consumerSurface: ctx.consumerSurface
            })
          : undefined;

        let magicMcpToken = await magicMcpTokenService.createMagicMcpToken({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          context: ctx.context,
          groups,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    delete: consumerMagicMcpTokenGroup
      .delete(consumerPath('magic-mcp-tokens/:magicMcpTokenId', 'magicMcpTokens.delete'), {
        name: 'Delete magic MCP token',
        description: 'Delete a specific magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:write'] }))
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpToken = await magicMcpTokenService.deleteMagicMcpToken({
          token: ctx.magicMcpToken
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    update: consumerMagicMcpTokenGroup
      .patch(consumerPath('magic-mcp-tokens/:magicMcpTokenId', 'magicMcpTokens.update'), {
        name: 'Update magic MCP token',
        description: 'Update the information of a specific magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'The name of the magic MCP token' })),
          description: v.optional(
            v.string({ description: 'The description of the magic MCP token' })
          ),
          metadata: v.optional(
            v.record(v.any(), { description: 'The metadata of the magic MCP token' })
          )
        })
      )
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpToken = await magicMcpTokenService.updateMagicMcpToken({
          token: ctx.magicMcpToken,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    addGroups: consumerMagicMcpTokenGroup
      .post(
        consumerPath(
          'magic-mcp-tokens/:magicMcpTokenId/add-groups',
          'magicMcpTokens.addGroups'
        ),
        {
          name: 'Add magic MCP groups to token',
          description: 'Add magic MCP groups to a specific magic MCP token'
        }
      )
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:write'] }))
      .body(
        'default',
        v.object({
          magic_mcp_group_ids: v.array(v.string(), {
            description: 'The IDs of the magic MCP groups to add to the token'
          })
        })
      )
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpToken = await magicMcpTokenService.addGroupsToToken({
          token: ctx.magicMcpToken,
          groupIds: ctx.body.magic_mcp_group_ids,
          consumerSurface: ctx.consumerSurface
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    removeGroups: consumerMagicMcpTokenGroup
      .post(
        consumerPath(
          'magic-mcp-tokens/:magicMcpTokenId/remove-groups',
          'magicMcpTokens.removeGroups'
        ),
        {
          name: 'Remove magic MCP groups from token',
          description: 'Remove magic MCP groups from a specific magic MCP token'
        }
      )
      .use(checkAccess({ possibleScopes: ['consumer#instance.magic_mcp:write'] }))
      .body(
        'default',
        v.object({
          magic_mcp_group_ids: v.array(v.string(), {
            description: 'The IDs of the magic MCP groups to remove from the token'
          })
        })
      )
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpToken = await magicMcpTokenService.removeGroupsFromToken({
          token: ctx.magicMcpToken,
          groupIds: ctx.body.magic_mcp_group_ids
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      })
  }
);
