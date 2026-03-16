import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { MagicMcpServerStatus } from '@metorial/db';
import { consumerAccessPolicyService } from '@metorial/module-consumer';
import { magicMcpServerService } from '@metorial/module-magic';
import { subspaceSessionTemplateService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../middleware/requireConsumerTokenForPublishableKey';
import { magicMcpServerPresenter } from '../../presenters';

export let magicMcpServerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpServerId) {
    throw new ServiceError(
      badRequestError({
        message: 'magicMcpServerId is required',
        description: 'The magicMcpServerId path parameter is required.'
      })
    );
  }

  let magicMcpServer = await magicMcpServerService.getMagicMcpServerById({
    magicMcpServerId: ctx.params.magicMcpServerId,
    instance: ctx.instance,
    accessTags: ctx.accessTags
  });

  return { magicMcpServer };
});

let magicMcpServerStatusValues = ['active', 'archived', 'deleted'] as const;

export let magicMcpServerController = Controller.create(
  {
    name: 'Magic MCP Servers',
    description:
      'Magic MCP servers are stable MCP entrypoints backed by one Subspace session template.'
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-servers', 'magicMcpServers.list'), {
        name: 'List magic MCP servers',
        description: 'Returns a paginated list of magic MCP servers.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read', 'consumer#instance.magic_mcp:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(magicMcpServerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf([...magicMcpServerStatusValues]),
                v.array(v.enumOf([...magicMcpServerStatusValues]))
              ])
            ),
            magic_mcp_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            search: v.optional(v.string())
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpServerService.listMagicMcpServers({
          instance: ctx.instance,
          status: normalizeArrayParam<MagicMcpServerStatus>(ctx.query.status),
          groupIds: normalizeArrayParam(ctx.query.magic_mcp_group_id),
          search: ctx.query.search,
          accessTags: ctx.accessTags
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpServer =>
          magicMcpServerPresenter.present({ magicMcpServer })
        );
      }),

    get: magicMcpServerGroup
      .get(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.get'), {
        name: 'Get magic MCP server',
        description: 'Retrieves a specific magic MCP server.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read', 'consumer#instance.magic_mcp:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpServerPresenter.present({ magicMcpServer: ctx.magicMcpServer });
      }),

    create: instanceGroup
      .post(instancePath('magic-mcp-servers', 'magicMcpServers.create'), {
        name: 'Create magic MCP server',
        description:
          'Creates a magic MCP server with a new session template. A Subspace session is created automatically on first connection and then reused.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write', 'consumer#instance.magic_mcp:write'],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let magicMcpServer = await magicMcpServerService.createMagicMcpServer({
          organization: ctx.organization,
          performedBy: ctx.actor!,
          instance: ctx.instance,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        if (ctx.consumerProfile) {
          for (let permission of ['magic_mcp_read', 'magic_mcp_write'] as const) {
            await consumerAccessPolicyService.grantAccess({
              organization: ctx.organization,
              permission,
              subject: {
                personalConsumerGroupForProfile: ctx.consumerProfile
              },
              resource: {
                magicMcpServer
              }
            });
          }
        }

        return magicMcpServerPresenter.present({ magicMcpServer });
      }),

    delete: magicMcpServerGroup
      .delete(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.delete'), {
        name: 'Delete magic MCP server',
        description: 'Archives a magic MCP server.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write', 'consumer#instance.magic_mcp:write'],
          fineGrainedPolicy: 'deny'
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpServer = await magicMcpServerService.archiveMagicMcpServer({
          server: ctx.magicMcpServer
        });

        return magicMcpServerPresenter.present({ magicMcpServer });
      }),

    update: magicMcpServerGroup
      .patch(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.update'), {
        name: 'Update magic MCP server',
        description: 'Updates a magic MCP server.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write', 'consumer#instance.magic_mcp:write'],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          aliases: v.optional(v.array(v.string())),
          session_template_id: v.optional(v.string())
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let sessionTemplateId = ctx.body.session_template_id;
        if (sessionTemplateId && !ctx.accessTags) {
          sessionTemplateId = (
            await subspaceSessionTemplateService.get({
              instance: ctx.instance,
              sessionTemplateId
            })
          ).id;
        }

        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpServer = await magicMcpServerService.updateMagicMcpServer({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            aliases: ctx.body.aliases,
            sessionTemplateId
          }
        });

        return magicMcpServerPresenter.present({ magicMcpServer });
      })
  }
);
