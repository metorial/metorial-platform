import { createMapper } from '@metorial/util-resource-mapper/compact';

export type AiGatewayTokensListOutput = {
  items: {
    object: 'ai_gateway.token';
    id: string;
    name: string;
    prefix: string;
    secret: string | null;
    consumer: {
      object: 'consumer#preview';
      id: string;
      name: string;
      email: string;
    } | null;
    allowedModels: string[];
    limits: {
      metric: 'requests' | 'tokens' | 'spend_usd';
      amount: number;
      interval: '1m' | '1h' | '1d' | '1mo';
    }[];
    metadata: Record<string, string>;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapAiGatewayTokensListOutput =
  /* @__PURE__ */ createMapper<AiGatewayTokensListOutput>(
    [
      7,
      [
        1,
        [
          'allowed_models',
          'last_used_at',
          'expires_at',
          'revoked_at',
          'created_at'
        ]
      ]
    ],
    1
  );

export type AiGatewayTokensListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { consumerId?: string | undefined };

export let mapAiGatewayTokensListQuery =
  /* @__PURE__ */ createMapper<AiGatewayTokensListQuery>([
    3,
    [[0, [1, ['consumer_id']]]]
  ]);
