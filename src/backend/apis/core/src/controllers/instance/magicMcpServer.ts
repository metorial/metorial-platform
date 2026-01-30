import { MagicMcpServerStatus, withTransaction } from '@metorial/db';
import { magicMcpServerService } from '@metorial/module-magic';
import { serverOAuthSessionService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { magicMcpServerPresenter } from '../../presenters';
import {
  createServerDeployment,
  createServerDeploymentAccessSchema,
  createServerDeploymentConfigSchema,
  createServerDeploymentImplementationSchema,
  createServerDeploymentOAuthConfigSchema,
  createServerDeploymentSchema
} from './serverDeployment';

export let magicMcpServerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpServerId) throw new Error('magicMcpServerId is required');

  let magicMcpServer = await magicMcpServerService.getMagicMcpServerById({
    magicMcpServerId: ctx.params.magicMcpServerId,
    instance: ctx.instance,
    accessTags: ctx.accessTags
  });

  return { magicMcpServer };
});

export let createMagicMcpServerSchema = v.intersection([
  v.intersection([
    v.object({
      name: v.string(),
      description: v.optional(v.string()),
      metadata: v.optional(v.record(v.any())),
      oauth_config: createServerDeploymentOAuthConfigSchema,
      access: createServerDeploymentAccessSchema
    }),
    createServerDeploymentConfigSchema
  ]),
  createServerDeploymentImplementationSchema
]);

export let magicMcpServerController = Controller.create(
  {
    name: 'Magic MCP Server',
    description:
      'Before you can connect to an MCP server, you need to create a magic MCP server.',
    deprecated: true
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-servers', 'magicMcpServers.list'), {
        name: 'List magic MCP server',
        description: 'List all magic MCP server'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.server.deployment:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .outputList(magicMcpServerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(MagicMcpServerStatus) as any),
                v.array(v.enumOf(Object.keys(MagicMcpServerStatus) as any))
              ]),
              { description: 'Filter by server status' }
            ),
            server_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by server ID(s)' }
            ),
            server_variant_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by server variant ID(s)' }
            ),
            server_implementation_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by server implementation ID(s)' }
            ),
            session_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by session ID(s)' }
            ),
            magic_mcp_group_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by magic MCP group ID(s)' }
            ),
            search: v.optional(
              v.string(),
              { description: 'Search servers by name' }
            )
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpServerService.listMagicMcpServers({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any,
          serverIds: normalizeArrayParam(ctx.query.server_id),
          serverVariantIds: normalizeArrayParam(ctx.query.server_variant_id),
          serverImplementationIds: normalizeArrayParam(ctx.query.server_implementation_id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
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
        description: 'Get the information of a specific magic MCP server'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.server.deployment:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpServerPresenter.present({ magicMcpServer: ctx.magicMcpServer });
      }),

    create: instanceGroup
      .post(instancePath('magic-mcp-servers', 'magicMcpServers.create'), {
        name: 'Create magic MCP server',
        description: 'Create a new magic MCP server'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.server.deployment:write',
            'consumer#instance.magic_mcp:write'
          ]
        })
      )
      .body(
        'default',
        v.intersection([
          createServerDeploymentSchema,
          v.object({
            default_oauth_session_id: v.optional(
              v.string({
                description:
                  'The ID of the default OAuth session to use for server deployments created by this magic MCP server'
              })
            )
          })
        ])
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return withTransaction(async db => {
          let serverDeployment = await createServerDeployment(
            ctx.body,
            {
              instance: ctx.instance,
              organization: ctx.organization,
              actor: ctx.actor,
              context: ctx.context,

              consumer: ctx.consumerProfile
                ? { profile: ctx.consumerProfile, accessTags: ctx.accessTags! }
                : undefined
            },
            { type: 'ephemeral', parent: 'magic_mcp_server' }
          );

          let defaultOauthSession = ctx.body.default_oauth_session_id
            ? await serverOAuthSessionService.getServerOAuthSessionById({
                instance: ctx.instance,
                serverOAuthSessionId: ctx.body.default_oauth_session_id,
                accessTags: ctx.accessTags
              })
            : undefined;

          let magicMcpServer = await magicMcpServerService.createMagicMcpServer({
            organization: ctx.organization,
            performedBy: ctx.actor,
            instance: ctx.instance,
            context: ctx.context,
            serverDeployment,
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              metadata: ctx.body.metadata,
              defaultOauthSession
            },
            consumer: ctx.consumerProfile ? { profile: ctx.consumerProfile } : undefined
          });

          return magicMcpServerPresenter.present({ magicMcpServer });
        });
      }),

    delete: magicMcpServerGroup
      .delete(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.delete'), {
        name: 'Delete magic MCP server',
        description: 'Delete a specific magic MCP server'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.server.deployment:write',
            'consumer#instance.magic_mcp:write'
          ]
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          accessTags: ctx.accessTags
        });

        let magicMcpServer = await magicMcpServerService.archiveMagicMcpServer({
          accessTags: ctx.accessTags,
          server: ctx.magicMcpServer
        });

        return magicMcpServerPresenter.present({ magicMcpServer });
      }),

    update: magicMcpServerGroup
      .patch(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.update'), {
        name: 'Update magic MCP server',
        description: 'Update the information of a specific magic MCP server'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.server.deployment:write',
            'consumer#instance.magic_mcp:write'
          ]
        })
      )
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
          ),
          default_oauth_session_id: v.optional(
            v.string({
              description:
                'The ID of the default OAuth session to use for server deployments created by this magic MCP server'
            })
          )
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          accessTags: ctx.accessTags
        });

        let defaultOauthSession = ctx.body.default_oauth_session_id
          ? await serverOAuthSessionService.getServerOAuthSessionById({
              instance: ctx.instance,
              serverOAuthSessionId: ctx.body.default_oauth_session_id,
              accessTags: ctx.accessTags
            })
          : undefined;

        let magicMcpServer = await magicMcpServerService.updateMagicMcpServer({
          server: ctx.magicMcpServer,
          accessTags: ctx.accessTags,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            aliases: ctx.body.aliases,
            defaultOauthSession
          }
        });

        return magicMcpServerPresenter.present({ magicMcpServer });
      })
  }
);
