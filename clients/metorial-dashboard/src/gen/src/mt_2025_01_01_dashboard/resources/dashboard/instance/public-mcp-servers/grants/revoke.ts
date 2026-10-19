import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePublicMcpServersGrantsRevokeOutput = {
  object: 'provider.public_mcp_server.grant';
  id: string;
  status: 'pending_exchange' | 'active' | 'revoked' | 'expired';
  revokedReason:
    | 'owner_revoked'
    | 'user_revoked'
    | 'refresh_token_reuse'
    | 'authorization_code_reuse'
    | 'server_archived'
    | 'idle_expired'
    | 'exchange_expired'
    | null;
  publicMcpServerId: string;
  client: {
    id: string;
    clientId: string;
    name: string;
    clientUri: string | null;
    logoUri: string | null;
  };
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePublicMcpServersGrantsRevokeOutput =
  /* @__PURE__ */ mapObject<DashboardInstancePublicMcpServersGrantsRevokeOutput>(
    [
      'revoked_reason',
      'public_mcp_server_id',
      ['client', 0, [1, ['client_id', 'client_uri', 'logo_uri']]],
      'last_used_at',
      'revoked_at',
      'expires_at',
      'created_at',
      'updated_at'
    ],
    1
  );
