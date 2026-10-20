import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { normalizeToolFilters } from '@metorial-subspace/module-provider-internal';
import {
  normalizePublicMcpSlug,
  publicMcpServerClientService,
  publicMcpServerGrantService,
  publicMcpServerService
} from '@metorial-subspace/module-public-mcp';
import {
  publicMcpServerClientPresenter,
  publicMcpServerGrantPresenter,
  publicMcpServerPresenter,
  publicMcpServerSlugAvailabilityPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { toolFiltersValidator } from '../sessions/_shared';

let PUBLIC_MCP_FLAG = 'public-mcp-servers-enabled' as const;

let publicMcpGroup = instanceGroup.use(hasFlags([PUBLIC_MCP_FLAG]));

let publicMcpServerGroup = publicMcpGroup.use(async ctx => {
  if (!ctx.params.publicMcpServerId) {
    throw new ServiceError(
      badRequestError({
        message: 'publicMcpServerId is required',
        description: 'The publicMcpServerId path parameter is required.'
      })
    );
  }

  let publicMcpServer = await publicMcpServerService.getPublicMcpServerById({
    instance: ctx.instance,
    publicMcpServerId: ctx.params.publicMcpServerId
  });

  return { publicMcpServer };
});

let publicMcpServerGrantGroup = publicMcpServerGroup.use(async ctx => {
  if (!ctx.params.publicMcpServerGrantId) {
    throw new ServiceError(
      badRequestError({
        message: 'publicMcpServerGrantId is required',
        description: 'The publicMcpServerGrantId path parameter is required.'
      })
    );
  }

  let grant = await publicMcpServerGrantService.getGrantById({
    instance: ctx.instance,
    publicMcpServer: ctx.publicMcpServer,
    publicMcpServerGrantId: ctx.params.publicMcpServerGrantId
  });

  return { grant };
});

let statusValues: ['active', 'disabled', 'archived'] = ['active', 'disabled', 'archived'];
let grantStatusValues: ['pending_exchange', 'active', 'revoked', 'expired'] = [
  'pending_exchange',
  'active',
  'revoked',
  'expired'
];

let settingsFields = {
  tool_filters: toolFiltersValidator,
  redirect_uri_filters: v.optional(
    v.array(v.string(), {
      description:
        'Allowed redirect URI patterns for dynamically registered clients. Defaults to the standard MCP client allow list.',
      examples: [['https://claude.ai/*', 'http://localhost:*']]
    })
  ),
  max_active_grants: v.optional(
    v.nullable(
      v.number({
        description: 'Maximum number of concurrently active end-user grants',
        examples: [1000]
      })
    )
  ),
  access_token_ttl_seconds: v.optional(
    v.number({ description: 'Lifetime of issued access tokens', examples: [3600] })
  ),
  refresh_token_ttl_seconds: v.optional(
    v.number({ description: 'Lifetime of issued refresh tokens', examples: [2592000] })
  ),
  grant_idle_expiry_seconds: v.optional(
    v.number({ description: 'Grants unused for this long expire', examples: [7776000] })
  )
};

let toSettingsInput = (body: {
  tool_filters?: unknown;
  redirect_uri_filters?: string[];
  max_active_grants?: number | null;
  access_token_ttl_seconds?: number;
  refresh_token_ttl_seconds?: number;
  grant_idle_expiry_seconds?: number;
}) => ({
  ...(body.tool_filters !== undefined
    ? { toolFilters: normalizeToolFilters(body.tool_filters as any) }
    : {}),
  redirectUriFilters: body.redirect_uri_filters,
  maxActiveGrants: body.max_active_grants,
  accessTokenTtlSeconds: body.access_token_ttl_seconds,
  refreshTokenTtlSeconds: body.refresh_token_ttl_seconds,
  grantIdleExpirySeconds: body.grant_idle_expiry_seconds
});

export let publicMcpServerController = Controller.create(
  {
    name: 'Public MCP Servers',
    description:
      'A public MCP server exposes a provider deployment at a public URL. Any MCP client can connect, and each end user brings their own credentials through OAuth.',
    hideInDocs: true
  },
  {
    list: publicMcpGroup
      .get(instancePath('public-mcp-servers', 'publicMcpServers.list'), {
        name: 'List public MCP servers',
        description: 'Returns a paginated list of public MCP servers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:read'] }))
      .outputList(publicMcpServerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([v.enumOf(statusValues), v.array(v.enumOf(statusValues))]),
              { description: 'Filter by status' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by public MCP server ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            created_at: dateFilterValidator('public MCP server creation time'),
            updated_at: dateFilterValidator('public MCP server last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await publicMcpServerService.listPublicMcpServers({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, publicMcpServer =>
          publicMcpServerPresenter.present({ publicMcpServer })
        );
      }),

    checkSlug: publicMcpGroup
      .get(
        instancePath('public-mcp-server-slugs/availability', 'publicMcpServers.slugs.check'),
        {
          name: 'Check public MCP server slug',
          description: 'Checks whether a slug can be claimed for a new public MCP server.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:read'] }))
      .query(
        'default',
        v.object({
          slug: v.string({ description: 'Slug to check', examples: ['acme-crm'] })
        })
      )
      .output(publicMcpServerSlugAvailabilityPresenter)
      .do(async ctx => {
        let isAvailable = await publicMcpServerService.isSlugAvailable({
          slug: ctx.query.slug
        });

        return publicMcpServerSlugAvailabilityPresenter.present({
          slug: normalizePublicMcpSlug(ctx.query.slug),
          isAvailable
        });
      }),

    get: publicMcpServerGroup
      .get(instancePath('public-mcp-servers/:publicMcpServerId', 'publicMcpServers.get'), {
        name: 'Get public MCP server',
        description: 'Retrieves a specific public MCP server by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:read'] }))
      .output(publicMcpServerPresenter)
      .do(async ctx =>
        publicMcpServerPresenter.present({ publicMcpServer: ctx.publicMcpServer })
      ),

    create: publicMcpGroup
      .post(instancePath('public-mcp-servers', 'publicMcpServers.create'), {
        name: 'Create public MCP server',
        description: 'Creates a public MCP server for a provider deployment.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:write'] }))
      .body(
        'default',
        v.object({
          provider_deployment_id: v.string({
            description: 'Provider deployment exposed by this server',
            examples: ['pdp_4dEfGhJkLmNpQrSt']
          }),
          name: v.string({
            description: 'Display name shown to end users during setup',
            examples: ['Acme CRM']
          }),
          slug: v.string({
            description: 'Globally unique slug used in the connect URL',
            examples: ['acme-crm']
          }),
          description: v.optional(v.string({ description: 'Description of the server' })),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom key-value pairs for storing additional information'
            })
          ),
          ...settingsFields
        })
      )
      .output(publicMcpServerPresenter)
      .do(async ctx => {
        let providerDeployment = await providerDeploymentService.getProviderDeploymentById({
          instance: ctx.instance,
          providerDeploymentId: ctx.body.provider_deployment_id
        });

        let publicMcpServer = await publicMcpServerService.createPublicMcpServer({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          providerDeployment,
          input: {
            name: ctx.body.name,
            slug: ctx.body.slug,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            ...toSettingsInput(ctx.body)
          }
        });

        return publicMcpServerPresenter.present({ publicMcpServer });
      }),

    update: publicMcpServerGroup
      .patch(
        instancePath('public-mcp-servers/:publicMcpServerId', 'publicMcpServers.update'),
        {
          name: 'Update public MCP server',
          description:
            'Updates a public MCP server. Set status to disabled to stop accepting connections.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'Display name' })),
          slug: v.optional(
            v.string({
              description: 'New slug. Existing connect URLs stop working after a rename.'
            })
          ),
          description: v.optional(v.nullable(v.string({ description: 'Description' }))),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom key-value pairs for storing additional information'
            })
          ),
          status: v.optional(
            v.enumOf(['active', 'disabled'] as const, {
              description: 'Enable or disable the server'
            })
          ),
          ...settingsFields
        })
      )
      .output(publicMcpServerPresenter)
      .do(async ctx => {
        let publicMcpServer = await publicMcpServerService.updatePublicMcpServer({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          publicMcpServer: ctx.publicMcpServer,
          input: {
            name: ctx.body.name,
            slug: ctx.body.slug,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            status: ctx.body.status,
            ...toSettingsInput(ctx.body)
          }
        });

        return publicMcpServerPresenter.present({ publicMcpServer });
      }),

    delete: publicMcpServerGroup
      .delete(
        instancePath('public-mcp-servers/:publicMcpServerId', 'publicMcpServers.delete'),
        {
          name: 'Delete public MCP server',
          description:
            'Archives a public MCP server, revokes every grant, and releases its slug.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:write'] }))
      .output(publicMcpServerPresenter)
      .do(async ctx => {
        let publicMcpServer = await publicMcpServerService.archivePublicMcpServer({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          publicMcpServer: ctx.publicMcpServer
        });

        return publicMcpServerPresenter.present({ publicMcpServer });
      }),

    listGrants: publicMcpServerGroup
      .get(
        instancePath(
          'public-mcp-servers/:publicMcpServerId/grants',
          'publicMcpServers.grants.list'
        ),
        {
          name: 'List public MCP server grants',
          description: 'Returns the end-user grants of a public MCP server.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:read'] }))
      .outputList(publicMcpServerGrantPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([v.enumOf(grantStatusValues), v.array(v.enumOf(grantStatusValues))]),
              { description: 'Filter by status. Excludes pending_exchange by default.' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by grant ID(s)'
            }),
            created_at: dateFilterValidator('grant creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await publicMcpServerGrantService.listGrants({
          instance: ctx.instance,
          publicMcpServer: ctx.publicMcpServer,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          createdAt: ctx.query.created_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, grant =>
          publicMcpServerGrantPresenter.present({ grant })
        );
      }),

    getGrant: publicMcpServerGrantGroup
      .get(
        instancePath(
          'public-mcp-servers/:publicMcpServerId/grants/:publicMcpServerGrantId',
          'publicMcpServers.grants.get'
        ),
        {
          name: 'Get public MCP server grant',
          description: 'Retrieves a specific end-user grant.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:read'] }))
      .output(publicMcpServerGrantPresenter)
      .do(async ctx => publicMcpServerGrantPresenter.present({ grant: ctx.grant })),

    revokeGrant: publicMcpServerGrantGroup
      .post(
        instancePath(
          'public-mcp-servers/:publicMcpServerId/grants/:publicMcpServerGrantId/revoke',
          'publicMcpServers.grants.revoke'
        ),
        {
          name: 'Revoke public MCP server grant',
          description:
            "Revokes an end-user grant. Its tokens stop working and the user's credentials are deleted."
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:write'] }))
      .output(publicMcpServerGrantPresenter)
      .do(async ctx => {
        let grant = await publicMcpServerGrantService.revokeGrant({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          publicMcpServer: ctx.publicMcpServer,
          grant: ctx.grant
        });

        return publicMcpServerGrantPresenter.present({ grant });
      }),

    listClients: publicMcpServerGroup
      .get(
        instancePath(
          'public-mcp-servers/:publicMcpServerId/clients',
          'publicMcpServers.clients.list'
        ),
        {
          name: 'List public MCP server clients',
          description: 'Returns the OAuth clients registered with a public MCP server.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.public_mcp_server:read'] }))
      .outputList(publicMcpServerClientPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await publicMcpServerClientService.listClients({
          instance: ctx.instance,
          publicMcpServer: ctx.publicMcpServer
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, client =>
          publicMcpServerClientPresenter.present({ client })
        );
      })
  }
);
