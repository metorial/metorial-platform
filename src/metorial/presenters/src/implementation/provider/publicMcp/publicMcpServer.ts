import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { presentOwnerActor, resourceAccessSchema } from '../../_shared';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import {
  publicMcpServerClientType,
  publicMcpServerGrantType,
  publicMcpServerSlugAvailabilityType,
  publicMcpServerType
} from '../../../types';
import { v1ProviderDeploymentPreviewPresenter } from '../config/deploymentPreview';

let getConnectUrls = (slug: string) => {
  let urls = getConfig().urls;
  let apiUrl = `${urls.apiUrl.replace(/\/+$/, '')}/connect/public/${slug}`;
  let proxyUrl = urls.publicMcpUrl ? `${urls.publicMcpUrl}/${slug}` : null;

  return {
    connectUrl: proxyUrl ?? apiUrl,
    alternateConnectUrls: proxyUrl ? [apiUrl] : []
  };
};

export let dashboardPublicMcpServerPresenter = Presenter.create(publicMcpServerType)
  .presenter(async ({ publicMcpServer }, opts) => {
    let { connectUrl, alternateConnectUrls } = getConnectUrls(publicMcpServer.slug);

    return {
      object: 'provider.public_mcp_server' as const,

      id: publicMcpServer.id,
      status: publicMcpServer.status,
      slug: publicMcpServer.slug,

      name: publicMcpServer.name,
      description: publicMcpServer.description,
      metadata: publicMcpServer.metadata,

      connect_url: connectUrl,
      alternate_connect_urls: alternateConnectUrls,

      provider_id: publicMcpServer.provider.id,
      deployment: await v1ProviderDeploymentPreviewPresenter
        .present(
          {
            deployment: { ...publicMcpServer.deployment, provider: publicMcpServer.provider }
          },
          opts
        )
        .run(),

      tool_filter: toolFilterPresenter(publicMcpServer.toolFilter),
      redirect_uri_filters: publicMcpServer.redirectUriFilters,
      max_active_grants: publicMcpServer.maxActiveGrants,
      access_token_ttl_seconds: publicMcpServer.accessTokenTtlSeconds,
      refresh_token_ttl_seconds: publicMcpServer.refreshTokenTtlSeconds,
      grant_idle_expiry_seconds: publicMcpServer.grantIdleExpirySeconds,

      access: {
        type: publicMcpServer.isOwnerLocked ? ('owner_locked' as const) : ('public' as const),
        visibility: publicMcpServer.isOwnerOnlyVisible
          ? ('owner' as const)
          : ('anyone' as const),
        owner: presentOwnerActor(publicMcpServer.ownerActor)
      },

      disabled_at: publicMcpServer.disabledAt,
      archived_at: publicMcpServer.archivedAt,
      created_at: publicMcpServer.createdAt,
      updated_at: publicMcpServer.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.public_mcp_server', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique public MCP server identifier',
        examples: ['pmsv_1aBcDeFgHjKlMnPq']
      }),
      status: v.enumOf(['active', 'disabled', 'archived', 'deleted'] as const, {
        name: 'status',
        description:
          'Status of the server. Disabled servers reject new connections and requests.'
      }),
      slug: v.string({
        name: 'slug',
        description: 'Globally unique slug used in the connect URL',
        examples: ['acme-crm']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name shown to end users during setup',
        examples: ['Acme CRM']
      }),
      description: v.nullable(
        v.string({ name: 'description', description: 'Description of the server' })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information'
        })
      ),
      connect_url: v.string({
        name: 'connect_url',
        description: 'URL MCP clients connect to',
        examples: ['https://mcp.metorial.com/acme-crm']
      }),
      alternate_connect_urls: v.array(v.string(), {
        name: 'alternate_connect_urls',
        description: 'Other URLs that reach the same server'
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      tool_filter: toolFilterPresenter.schema,
      redirect_uri_filters: v.array(v.string(), {
        name: 'redirect_uri_filters',
        description: 'Allowed redirect URI patterns for dynamically registered clients'
      }),
      max_active_grants: v.nullable(
        v.number({
          name: 'max_active_grants',
          description: 'Maximum number of concurrently active end-user grants'
        })
      ),
      access_token_ttl_seconds: v.number({
        name: 'access_token_ttl_seconds',
        description: 'Lifetime of issued access tokens',
        examples: [3600]
      }),
      refresh_token_ttl_seconds: v.number({
        name: 'refresh_token_ttl_seconds',
        description: 'Lifetime of issued refresh tokens',
        examples: [2592000]
      }),
      grant_idle_expiry_seconds: v.number({
        name: 'grant_idle_expiry_seconds',
        description: 'Grants unused for this long expire',
        examples: [7776000]
      }),
      access: resourceAccessSchema,
      disabled_at: v.nullable(v.date({ name: 'disabled_at', description: 'When disabled' })),
      archived_at: v.nullable(v.date({ name: 'archived_at', description: 'When archived' })),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created' }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated' })
    })
  )
  .build();

let clientSummary = (client: {
  id: string;
  clientId: string;
  clientName: string;
  clientUri: string | null;
  logoUri: string | null;
}) => ({
  id: client.id,
  client_id: client.clientId,
  name: client.clientName,
  client_uri: client.clientUri,
  logo_uri: client.logoUri
});

let clientSummarySchema = v.object({
  id: v.string({ name: 'id', description: 'Client record ID' }),
  client_id: v.string({ name: 'client_id', description: 'OAuth client_id' }),
  name: v.string({
    name: 'name',
    description: 'Self-reported client name. Not verified.'
  }),
  client_uri: v.nullable(
    v.string({ name: 'client_uri', description: 'Self-reported client URI' })
  ),
  logo_uri: v.nullable(v.string({ name: 'logo_uri', description: 'Self-reported logo URI' }))
});

export let dashboardPublicMcpServerGrantPresenter = Presenter.create(publicMcpServerGrantType)
  .presenter(async ({ grant }) => ({
    object: 'provider.public_mcp_server.grant' as const,

    id: grant.id,
    status: grant.status,
    revoked_reason: grant.revokedReason,

    public_mcp_server_id: grant.publicMcpServer.id,
    client: clientSummary(grant.client),

    last_used_at: grant.lastUsedAt,
    revoked_at: grant.revokedAt,
    expires_at: grant.expiresAt,
    created_at: grant.createdAt,
    updated_at: grant.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.public_mcp_server.grant', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique grant identifier',
        examples: ['pmgr_1aBcDeFgHjKlMnPq']
      }),
      status: v.enumOf(['pending_exchange', 'active', 'revoked', 'expired'] as const, {
        name: 'status',
        description: 'Status of the grant'
      }),
      revoked_reason: v.nullable(
        v.enumOf(
          [
            'owner_revoked',
            'user_revoked',
            'refresh_token_reuse',
            'authorization_code_reuse',
            'server_archived',
            'idle_expired',
            'exchange_expired'
          ] as const,
          { name: 'revoked_reason', description: 'Why the grant ended' }
        )
      ),
      public_mcp_server_id: v.string({
        name: 'public_mcp_server_id',
        description: 'Public MCP server ID'
      }),
      client: clientSummarySchema,
      last_used_at: v.nullable(v.date({ name: 'last_used_at', description: 'Last use' })),
      revoked_at: v.nullable(v.date({ name: 'revoked_at', description: 'When revoked' })),
      expires_at: v.date({ name: 'expires_at', description: 'When the grant expires' }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created' }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated' })
    })
  )
  .build();

export let dashboardPublicMcpServerClientPresenter = Presenter.create(
  publicMcpServerClientType
)
  .presenter(async ({ client }) => ({
    object: 'provider.public_mcp_server.client' as const,

    ...clientSummary(client),

    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,

    last_used_at: client.lastUsedAt,
    expires_at: client.expiresAt,
    created_at: client.createdAt
  }))
  .schema(
    v.intersection([
      clientSummarySchema,
      v.object({
        object: v.literal('provider.public_mcp_server.client', {
          description: "String representing the object's type"
        }),

        redirect_uris: v.array(v.string(), {
          name: 'redirect_uris',
          description: 'Registered redirect URIs'
        }),
        token_endpoint_auth_method: v.enumOf(
          ['client_secret_basic', 'client_secret_post', 'none'],
          { name: 'token_endpoint_auth_method', description: 'Token endpoint auth method' }
        ),
        last_used_at: v.nullable(v.date({ name: 'last_used_at', description: 'Last use' })),
        expires_at: v.date({
          name: 'expires_at',
          description: 'The registration expires after this long without use'
        }),
        created_at: v.date({ name: 'created_at', description: 'Timestamp when registered' })
      })
    ])
  )
  .build();

export let dashboardPublicMcpServerSlugAvailabilityPresenter = Presenter.create(
  publicMcpServerSlugAvailabilityType
)
  .presenter(async ({ slug, isAvailable }) => ({
    object: 'provider.public_mcp_server.slug_availability' as const,
    slug,
    is_available: isAvailable
  }))
  .schema(
    v.object({
      object: v.literal('provider.public_mcp_server.slug_availability', {
        description: "String representing the object's type"
      }),
      slug: v.string({ name: 'slug', description: 'Normalized slug that was checked' }),
      is_available: v.boolean({
        name: 'is_available',
        description: 'Whether the slug can be claimed'
      })
    })
  )
  .build();
