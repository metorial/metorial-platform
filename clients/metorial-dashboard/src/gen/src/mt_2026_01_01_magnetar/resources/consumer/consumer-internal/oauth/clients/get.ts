import { mtMap } from '@metorial/util-resource-mapper';

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
  portalId: string;
  magicMcpServerId: string | null;
  magicMcpEndpointId: string | null;
  createdAt: Date;
  expiresAt: Date;
};

export let mapConsumerConsumerInternalOauthClientsGetOutput =
  mtMap.object<ConsumerConsumerInternalOauthClientsGetOutput>({
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
  });

