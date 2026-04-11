import { mtMap } from '@metorial/util-resource-mapper';

export type ConsumerConsumerInternalOauthAuthorizationsAcceptOutput = {
  object: 'portal.oauth_authorization';
  id: string;
  status: 'pending' | 'authorized' | 'active' | 'denied' | 'revoked';
  redirectUri: string;
  redirectUrl: string | null;
  consumerProfileId: string | null;
  magicMcpEndpointId: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  authorizedAt: Date | null;
  deniedAt: Date | null;
  oauthClient: {
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
    consumerSurfaceId: string;
    magicMcpServerId: string | null;
    magicMcpEndpointId: string | null;
    createdAt: Date;
    expiresAt: Date;
  };
};

export let mapConsumerConsumerInternalOauthAuthorizationsAcceptOutput =
  mtMap.object<ConsumerConsumerInternalOauthAuthorizationsAcceptOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    redirectUri: mtMap.objectField('redirect_uri', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough()),
    consumerProfileId: mtMap.objectField(
      'consumer_profile_id',
      mtMap.passthrough()
    ),
    magicMcpEndpointId: mtMap.objectField(
      'magic_mcp_endpoint_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date()),
    authorizedAt: mtMap.objectField('authorized_at', mtMap.date()),
    deniedAt: mtMap.objectField('denied_at', mtMap.date()),
    oauthClient: mtMap.objectField(
      'oauth_client',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        clientId: mtMap.objectField('client_id', mtMap.passthrough()),
        redirectUris: mtMap.objectField(
          'redirect_uris',
          mtMap.array(mtMap.passthrough())
        ),
        tokenEndpointAuthMethod: mtMap.objectField(
          'token_endpoint_auth_method',
          mtMap.passthrough()
        ),
        portalId: mtMap.objectField('portal_id', mtMap.passthrough()),
        consumerSurfaceId: mtMap.objectField(
          'consumer_surface_id',
          mtMap.passthrough()
        ),
        magicMcpServerId: mtMap.objectField(
          'magic_mcp_server_id',
          mtMap.passthrough()
        ),
        magicMcpEndpointId: mtMap.objectField(
          'magic_mcp_endpoint_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        expiresAt: mtMap.objectField('expires_at', mtMap.date())
      })
    )
  });

