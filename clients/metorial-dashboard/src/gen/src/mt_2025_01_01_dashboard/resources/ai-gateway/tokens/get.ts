import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AiGatewayTokensGetOutput = {
  object: 'ai_gateway.token';
  id: string;
  name: string;
  prefix: string;
  secret: string | null;
  consumerRef: string | null;
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
};

export let mapAiGatewayTokensGetOutput =
  /* @__PURE__ */ mapObject<AiGatewayTokensGetOutput>(
    [
      'consumer_ref',
      'allowed_models',
      'last_used_at',
      'expires_at',
      'revoked_at',
      'created_at'
    ],
    1
  );
