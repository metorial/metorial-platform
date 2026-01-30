import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerSessionType } from '../../types';

export let v1ProviderSessionPresenter = Presenter.create(providerSessionType)
  .presenter(async ({ session }) => ({
    object: 'session' as const,
    id: session.id,
    name: session.name,
    description: session.description,
    status: session.status ?? 'active',
    connection_status: session.connectionStatus ?? 'disconnected',
    metadata: session.metadata,
    provider_deployments: (session.providerDeployments ?? []).map(pd => ({
      object: 'session.provider_deployment#preview' as const,
      id: pd.id,
      name: pd.name,
      provider_id: pd.providerId,
      provider_deployment_id: pd.providerDeploymentId,
      connection_urls: {
        sse: `${getConfig().urls.mcpUrl}/mcp/${session.id}/${pd.providerDeploymentId ?? pd.id}/sse`,
        streamable_http: `${getConfig().urls.mcpUrl}/mcp/${session.id}/${pd.providerDeploymentId ?? pd.id}/mcp`
      }
    })),
    client_secret: session.clientSecret ? {
      object: 'client_secret' as const,
      type: 'session' as const,
      id: session.clientSecret.id,
      secret: session.clientSecret.secret,
      expires_at: session.clientSecret.expiresAt
    } : null,
    created_at: session.createdAt,
    updated_at: session.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique session identifier', examples: ['ses_4dEfGhJkLmNpQrSt'] }),
      name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['Production Session'] })),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['Session for production environment'] })),
      status: v.enumOf(['active', 'deleted'], { name: 'status', description: 'Session status' }),
      connection_status: v.enumOf(['connected', 'disconnected'], { name: 'connection_status', description: 'Connection state' }),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom key-value pairs', examples: [{ environment: 'production' }] })),
      provider_deployments: v.array(
        v.object({
          object: v.literal('session.provider_deployment#preview', { description: "String representing the object's type" }),
          id: v.string({ name: 'id', description: 'Session provider ID', examples: ['spr_3cDeFgHjKlMnPqRs'] }),
          name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['GitHub Provider'] })),
          provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pro_5gHjKlMnPqRsTuVw'] }),
          provider_deployment_id: v.nullable(v.string({ name: 'provider_deployment_id', description: 'Provider deployment ID', examples: ['pde_1aBcDeFgHjKlMnPq'] })),
          connection_urls: v.object({
            sse: v.string({ name: 'sse', description: 'URL for Server-Sent Events connection', examples: ['https://mcp.metorial.io/mcp/ses_4dEfGhJkLmNpQrSt/pde_1aBcDeFgHjKlMnPq/sse'] }),
            streamable_http: v.string({ name: 'streamable_http', description: 'URL for Streamable HTTP connection', examples: ['https://mcp.metorial.io/mcp/ses_4dEfGhJkLmNpQrSt/pde_1aBcDeFgHjKlMnPq/mcp'] })
          }, { name: 'connection_urls', description: 'Connection URLs for this provider deployment' })
        }),
        { name: 'provider_deployments', description: 'List of provider deployments in this session' }
      ),
      client_secret: v.nullable(v.object({
        object: v.literal('client_secret', { description: "String representing the object's type" }),
        type: v.enumOf(['session'], { name: 'type', description: 'The type of client secret' }),
        id: v.string({ name: 'id', description: 'The unique identifier of the client secret', examples: ['csk_2bCdEfGhJkLmNpQr'] }),
        secret: v.string({ name: 'secret', description: 'The secret token for the session client', examples: ['sk_live_...'] }),
        expires_at: v.date({ name: 'expires_at', description: 'Expiration date of the client secret' })
      }, { name: 'client_secret', description: 'Client secret object associated with this session' })),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2026-01-10T14:45:00Z')] })
    })
  )
  .build();
