import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AiGatewayTokensUpdateOutput = {
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
};

export let mapAiGatewayTokensUpdateOutput =
  /* @__PURE__ */ mapObject<AiGatewayTokensUpdateOutput>(
    [
      'allowed_models',
      'last_used_at',
      'expires_at',
      'revoked_at',
      'created_at'
    ],
    1
  );

export type AiGatewayTokensUpdateBody = {
  name?: string | undefined;
  allowedModels?: string[] | undefined;
  limits?:
    | {
        metric: 'requests' | 'tokens' | 'spend_usd';
        amount: number;
        interval: '1m' | '1h' | '1d' | '1mo';
      }[]
    | undefined;
  metadata?: Record<string, string> | undefined;
  expiresAt?: Date | null | undefined;
};

export let mapAiGatewayTokensUpdateBody =
  /* @__PURE__ */ mapObject<AiGatewayTokensUpdateBody>(
    ['allowed_models', 'expires_at'],
    1
  );
