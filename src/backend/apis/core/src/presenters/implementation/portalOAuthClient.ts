import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { portalOAuthClientType } from '../types';

export let v1PortalOAuthClientPresenter = Presenter.create(portalOAuthClientType)
  .presenter(async ({ portalAuthClient }) => ({
    object: 'portal.oauth_client' as const,
    id: portalAuthClient.id,
    name: portalAuthClient.name,
    client_id: portalAuthClient.clientId,
    redirect_uris: portalAuthClient.redirectUris,
    token_endpoint_auth_method: portalAuthClient.tokenEndpointAuthMethod,
    portal_id: portalAuthClient.portal.id,
    magic_mcp_server_id: portalAuthClient.magicMcpServer.id,
    created_at: portalAuthClient.createdAt,
    expires_at: portalAuthClient.expiresAt
  }))
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
      portal_id: v.string(),
      magic_mcp_server_id: v.string(),
      created_at: v.date(),
      expires_at: v.date()
    })
  )
  .build();
