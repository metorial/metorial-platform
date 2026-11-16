import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointOutput =
  {
    object: 'portal.oauth_authorization';
    id: string;
    status: 'pending' | 'authorized' | 'active' | 'denied' | 'revoked';
    redirectUri: string;
    redirectUrl: string | null;
    consumerProfileId: string | null;
    magicMcpEndpointId: string | null;
    skillPlugin: {
      id: string;
      name: string | null;
      slug: string | null;
    } | null;
    skillPluginSupportedProviderIds: string[];
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
        'client_secret_basic' | 'client_secret_post' | 'none';
      portalId: string | null;
      consumerSurfaceId: string | null;
      skillPlugin: {
        id: string;
        name: string | null;
        slug: string | null;
      } | null;
      magicMcpServerId: string | null;
      magicMcpEndpointId: string | null;
      createdAt: Date;
      expiresAt: Date;
    };
  };

export let mapConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointOutput =
  /* @__PURE__ */ mapObject<ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointOutput>(
    [
      'redirect_uri',
      'redirect_url',
      'consumer_profile_id',
      'magic_mcp_endpoint_id',
      'skill_plugin',
      'skill_plugin_supported_provider_ids',
      'created_at',
      'updated_at',
      'expires_at',
      'authorized_at',
      'denied_at',
      [
        'oauth_client',
        1,
        [
          1,
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
          ]
        ]
      ]
    ],
    1
  );

export type ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointBody =
  { magicMcpEndpointId: string };

export let mapConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointBody =
  /* @__PURE__ */ mapObject<ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointBody>(
    ['magic_mcp_endpoint_id']
  );
