import { createMapper } from '@metorial/util-resource-mapper/compact';

export type PublicMcpServersGrantsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapPublicMcpServersGrantsListOutput =
  /* @__PURE__ */ createMapper<PublicMcpServersGrantsListOutput>(
    [
      7,
      [
        1,
        [
          'revoked_reason',
          'public_mcp_server_id',
          ['client', 0, [1, ['client_id', 'client_uri', 'logo_uri']]],
          'last_used_at',
          'revoked_at',
          'expires_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type PublicMcpServersGrantsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'pending_exchange'
    | 'active'
    | 'revoked'
    | 'expired'
    | ('pending_exchange' | 'active' | 'revoked' | 'expired')[]
    | undefined;
  id?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapPublicMcpServersGrantsListQuery =
  /* @__PURE__ */ createMapper<PublicMcpServersGrantsListQuery>([
    3,
    [[0, [1, [['created_at', 1, 5]]]]]
  ]);
