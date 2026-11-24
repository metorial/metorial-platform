import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePublicMcpServersClientsListOutput = {
  items: ({
    id: string;
    clientId: string;
    name: string;
    clientUri: string | null;
    logoUri: string | null;
  } & {
    object: 'provider.public_mcp_server.client';
    redirectUris: string[];
    tokenEndpointAuthMethod:
      'client_secret_basic' | 'client_secret_post' | 'none';
    lastUsedAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstancePublicMcpServersClientsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePublicMcpServersClientsListOutput>(
    [
      7,
      [
        3,
        [
          [
            0,
            [
              1,
              [
                'client_id',
                'client_uri',
                'logo_uri',
                'redirect_uris',
                'token_endpoint_auth_method',
                'last_used_at',
                'expires_at',
                'created_at'
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstancePublicMcpServersClientsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstancePublicMcpServersClientsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstancePublicMcpServersClientsListQuery>(
    0
  );
