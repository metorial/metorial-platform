import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerConsumerInternalOauthClientsGetOutput = {
  object: 'portal.oauth_client';
  id: string;
  name: string;
  clientId: string;
  redirectUris: string[];
  tokenEndpointAuthMethod:
    | 'client_secret_basic'
    | 'client_secret_post'
    | 'none';
  portalId: string | null;
  consumerSurfaceId: string | null;
  skillPlugin: { id: string; name: string | null; slug: string | null } | null;
  magicMcpServerId: string | null;
  magicMcpEndpointId: string | null;
  createdAt: Date;
  expiresAt: Date;
};

export let mapConsumerConsumerInternalOauthClientsGetOutput =
  /* @__PURE__ */ mapObject<ConsumerConsumerInternalOauthClientsGetOutput>(
    [
      'client_id',
      'redirect_uris',
      'token_endpoint_auth_method',
      'portal_id',
      'consumer_surface_id',
      'skill_plugin',
      'magic_mcp_server_id',
      'magic_mcp_endpoint_id',
      'created_at',
      'expires_at'
    ],
    1
  );
