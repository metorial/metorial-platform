import { badRequestError, ServiceError } from '@lowerdeck/error';
import { magicMcpSessionService } from '@metorial/module-magic';
import { Paginator } from '@lowerdeck/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@lowerdeck/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../middleware/requireConsumerTokenForPublishableKey';
import { magicMcpSessionPresenter } from '../../presenters';

export let magicMcpSessionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'magicMcpSessionId is required',
        description: 'The magicMcpSessionId path parameter is required.'
      })
    );
  }

  let magicMcpSession = await magicMcpSessionService.getMagicMcpSessionById({
    magicMcpSessionId: ctx.params.magicMcpSessionId,
    instance: ctx.instance,
    accessTags: ctx.accessTags
  });

  return { magicMcpSession };
});

export let magicMcpSessionController = Controller.create(
  {
    name: 'Magic MCP Sessions',
    description:
      'Magic MCP sessions map a Magic MCP server to one Subspace session and are created on demand by the MCP connection API.'
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-sessions', 'magicMcpSessions.list'), {
        name: 'List magic MCP sessions',
        description: 'Returns a paginated list of magic MCP sessions.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read', 'consumer#instance.magic_mcp:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
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
          magicMcpServerId: normalizeArrayParam(ctx.query.magic_mcp_server_id),
          accessTags: ctx.accessTags
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpSession =>
          magicMcpSessionPresenter.present({ magicMcpSession })
        );
      }),

    get: magicMcpSessionGroup
      .get(instancePath('magic-mcp-sessions/:magicMcpSessionId', 'magicMcpSessions.get'), {
        name: 'Get magic MCP session',
        description: 'Retrieves a specific magic MCP session.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read', 'consumer#instance.magic_mcp:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpSessionPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpSessionPresenter.present({ magicMcpSession: ctx.magicMcpSession });
      })
  }
);
