import { MagicMcpTokenStatus } from '@metorial/db';
import { magicMcpTokenService } from '@metorial/module-magic';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { magicMcpTokenPresenter } from '../../presenters';

export let magicMcpTokenGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpTokenId) throw new Error('magicMcpTokenId is required');

  let magicMcpToken = await magicMcpTokenService.getMagicMcpTokenById({
    magicMcpTokenId: ctx.params.magicMcpTokenId,
    instance: ctx.instance
  });

  return { magicMcpToken };
});

export let magicMcpTokenController = Controller.create(
  {
    name: 'Magic MCP Token',
    description:
      'Before you can connect to an MCP server, you need to create a magic MCP token.'
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-tokens', 'magicMcpTokens.list'), {
        name: 'List magic MCP token',
        description: 'List all magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
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
            )
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpTokenService.listMagicMcpTokens({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpToken =>
          magicMcpTokenPresenter.present({ magicMcpToken })
        );
      }),

    get: magicMcpTokenGroup
      .get(instancePath('magic-mcp-tokens/:magicMcpTokenId', 'magicMcpTokens.get'), {
        name: 'Get magic MCP token',
        description: 'Get the information of a specific magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpTokenPresenter.present({ magicMcpToken: ctx.magicMcpToken });
      }),

    create: instanceGroup
      .post(instancePath('magic-mcp-tokens', 'magicMcpTokens.create'), {
        name: 'Create magic MCP token',
        description: 'Create a new magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ description: 'The name of the magic MCP token' }),
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
        let magicMcpToken = await magicMcpTokenService.createMagicMcpToken({
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

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    delete: magicMcpTokenGroup
      .delete(instancePath('magic-mcp-tokens/:magicMcpTokenId', 'magicMcpTokens.delete'), {
        name: 'Delete magic MCP token',
        description: 'Delete a specific magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:write'] }))
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpToken = await magicMcpTokenService.deletedMagicMcpToken({
          token: ctx.magicMcpToken
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    update: magicMcpTokenGroup
      .patch(instancePath('magic-mcp-tokens/:magicMcpTokenId', 'magicMcpTokens.update'), {
        name: 'Update magic MCP token',
        description: 'Update the information of a specific magic MCP token'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:write'] }))
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
      })
  }
);
