import {
  badRequestError,
  isServiceError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { magicMcpServerService } from '@metorial/module-magic';
import { subspaceSessionTemplateProviderService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../middleware/requireConsumerTokenForPublishableKey';
import { magicMcpServerProviderPresenter } from '../../presenters';
import { magicMcpServerGroup } from './magicMcpServer';
import { toolFiltersValidator } from './session';

let magicMcpServerProviderGroup = magicMcpServerGroup.use(async ctx => {
  if (!ctx.params.magicMcpServerProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'magicMcpServerProviderId is required',
        description: 'The magicMcpServerProviderId path parameter is required.'
      })
    );
  }

  try {
    let sessionTemplateProvider = await subspaceSessionTemplateProviderService.get({
      instance: ctx.instance,
      sessionTemplateProviderId: ctx.params.magicMcpServerProviderId
    });

    if (
      sessionTemplateProvider.sessionTemplateId !==
      ctx.magicMcpServer.subspaceSessionTemplateId
    ) {
      throw new ServiceError(notFoundError('magic_mcp.server.provider'));
    }

    return { sessionTemplateProvider };
  } catch (err) {
    if (isServiceError(err) && err.data.code === 'not_found') {
      throw new ServiceError(notFoundError('magic_mcp.server.provider'));
    }

    throw err;
  }
});

export let magicMcpServerProviderController = Controller.create(
  {
    name: 'Magic MCP Server Providers',
    description:
      'Magic MCP server providers define which providers are included in the setup session template backing a magic MCP server.'
  },
  {
    list: magicMcpServerGroup
      .get(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/provider',
          'magicMcpServers.provider.list'
        ),
        {
          name: 'List magic MCP server providers',
          description:
            'Returns a paginated list of providers configured for a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(magicMcpServerProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by magic MCP server provider ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider config ID(s)'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID(s)'
            }),
            created_at: dateFilterValidator('magic MCP server provider creation time'),
            updated_at: dateFilterValidator('magic MCP server provider last update time')
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await subspaceSessionTemplateProviderService.list({
          instance: ctx.instance,
          allowDeleted: false,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          sessionTemplateIds: [ctx.magicMcpServer.subspaceSessionTemplateId],
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionTemplateProvider =>
          magicMcpServerProviderPresenter.present({
            magicMcpServer: ctx.magicMcpServer,
            sessionTemplateProvider
          })
        );
      }),

    get: magicMcpServerProviderGroup
      .get(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/provider/:magicMcpServerProviderId',
          'magicMcpServers.provider.get'
        ),
        {
          name: 'Get magic MCP server provider',
          description: 'Retrieves a specific provider configuration from a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpServerProviderPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          sessionTemplateProvider: ctx.sessionTemplateProvider
        });
      }),

    create: magicMcpServerGroup
      .post(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/provider',
          'magicMcpServers.provider.create'
        ),
        {
          name: 'Create magic MCP server provider',
          description: 'Adds a new provider configuration to a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          provider_deployment_id: v.optional(v.string()),
          provider_config_id: v.optional(v.string()),
          provider_config_vault_id: v.optional(v.string()),
          provider_auth_config_id: v.optional(v.string()),
          tool_filters: toolFiltersValidator
        })
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpServerProviderPresenter)
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let input = {
          instance: ctx.instance,
          sessionTemplateId: ctx.magicMcpServer.subspaceSessionTemplateId,
          providerDeploymentId: ctx.body.provider_deployment_id,
          providerConfigId: ctx.body.provider_config_id,
          providerConfigVaultId: ctx.body.provider_config_vault_id,
          providerAuthConfigId: ctx.body.provider_auth_config_id,
          toolFilters: ctx.body.tool_filters
        } as Parameters<typeof subspaceSessionTemplateProviderService.create>[0];

        let sessionTemplateProvider =
          await subspaceSessionTemplateProviderService.create(input);

        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          sessionTemplateProvider
        });
      }),

    update: magicMcpServerProviderGroup
      .patch(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/provider/:magicMcpServerProviderId',
          'magicMcpServers.provider.update'
        ),
        {
          name: 'Update magic MCP server provider',
          description: 'Updates a provider configuration in a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          tool_filters: toolFiltersValidator
        })
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpServerProviderPresenter)
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let sessionTemplateProvider = await subspaceSessionTemplateProviderService.update({
          instance: ctx.instance,
          sessionTemplateProviderId: ctx.sessionTemplateProvider.id,
          toolFilters: ctx.body.tool_filters
        });

        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          sessionTemplateProvider
        });
      }),

    delete: magicMcpServerProviderGroup
      .delete(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/provider/:magicMcpServerProviderId',
          'magicMcpServers.provider.delete'
        ),
        {
          name: 'Delete magic MCP server provider',
          description: 'Removes a provider configuration from a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ],
          fineGrainedPolicy: 'deny'
        })
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpServerProviderPresenter)
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        await subspaceSessionTemplateProviderService.delete({
          instance: ctx.instance,
          sessionTemplateProviderId: ctx.sessionTemplateProvider.id
        });

        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          sessionTemplateProvider: ctx.sessionTemplateProvider
        });
      })
  }
);
