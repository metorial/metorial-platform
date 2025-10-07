import { magicMcpSessionService } from '@metorial/module-magic';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { magicMcpSessionPresenter } from '../../presenters';

export let magicMcpSessionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpSessionId) throw new Error('magicMcpSessionId is required');

  let magicMcpSession = await magicMcpSessionService.getMagicMcpSessionById({
    magicMcpSessionId: ctx.params.magicMcpSessionId,
    instance: ctx.instance
  });

  return { magicMcpSession };
});

export let magicMcpSessionController = Controller.create(
  {
    name: 'Magic MCP Session',
    description:
      'Magic MCP sessions are created when a user connects to a magic MCP session using a valid magic MCP token.'
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-sessions', 'magicMcpSessions.list'), {
        name: 'List magic MCP session',
        description: 'List all magic MCP session'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .outputList(magicMcpSessionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            magic_mcp_server_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpSessionService.listMagicMcpSessions({
          instance: ctx.instance,
          magicMcpServerId: normalizeArrayParam(ctx.query.magic_mcp_server_id) as any
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpSession =>
          magicMcpSessionPresenter.present({ magicMcpSession })
        );
      }),

    get: magicMcpSessionGroup
      .get(instancePath('magic-mcp-sessions/:magicMcpSessionId', 'magicMcpSessions.get'), {
        name: 'Get magic MCP session',
        description: 'Get the information of a specific magic MCP session'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .output(magicMcpSessionPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpSessionPresenter.present({ magicMcpSession: ctx.magicMcpSession });
      })
  }
);
