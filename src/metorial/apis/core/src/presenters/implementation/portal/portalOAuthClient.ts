import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { portalOAuthClientType } from '../../types';

export let v1PortalOAuthClientPresenter = Presenter.create(portalOAuthClientType)
  .presenter(async ({ portalAuthClient }) => {
    let consumerSurface:
      | (typeof portalAuthClient.consumerAuthClientSurfaces)[number]['consumerSurface']
      | null = portalAuthClient.consumerAuthClientSurfaces[0]?.consumerSurface ?? null;
    let portalId: string | null = consumerSurface?.portal?.id ?? null;
    let consumerSurfaceId: string | null = consumerSurface?.id ?? null;

    let output: {
      object: 'portal.oauth_client';
      id: string;
      name: string;
      client_id: string;
      redirect_uris: string[];
      token_endpoint_auth_method: 'client_secret_basic' | 'client_secret_post' | 'none';
      portal_id: string | null;
      consumer_surface_id: string | null;
      skill_plugin: { id: string; name: string | null; slug: string | null } | null;
      magic_mcp_server_id: string | null;
      magic_mcp_endpoint_id: string | null;
      created_at: Date;
      expires_at: Date;
    } = {
      object: 'portal.oauth_client' as const,
      id: portalAuthClient.id,
      name: portalAuthClient.name,
      client_id: portalAuthClient.clientId,
      redirect_uris: portalAuthClient.redirectUris,
      token_endpoint_auth_method: portalAuthClient.tokenEndpointAuthMethod,
      portal_id: portalId,
      consumer_surface_id: consumerSurfaceId,
      skill_plugin: portalAuthClient.skillPlugin
        ? {
            id: portalAuthClient.skillPlugin.id,
            name: portalAuthClient.skillPlugin.name,
            slug: portalAuthClient.skillPlugin.slug
          }
        : null,
      magic_mcp_server_id: portalAuthClient.magicMcpServer?.id ?? null,
      magic_mcp_endpoint_id: portalAuthClient.magicMcpEndpoint?.id ?? null,
      created_at: portalAuthClient.createdAt,
      expires_at: portalAuthClient.expiresAt
    };

    return output;
  })
  .schema(
    v.object({
      object: v.literal('portal.oauth_client'),
      id: v.string(),
      name: v.string(),
      client_id: v.string(),
      redirect_uris: v.array(v.string()),
      token_endpoint_auth_method: v.enumOf([
        'client_secret_basic',
        'client_secret_post',
        'none'
      ]),
      portal_id: v.nullable(v.string()),
      consumer_surface_id: v.nullable(v.string()),
      skill_plugin: v.nullable(
        v.object({
          id: v.string(),
          name: v.nullable(v.string()),
          slug: v.nullable(v.string())
        })
      ),
      magic_mcp_server_id: v.nullable(v.string()),
      magic_mcp_endpoint_id: v.nullable(v.string()),
      created_at: v.date(),
      expires_at: v.date()
    })
  )
  .build();
