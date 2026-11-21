import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceAiGatewayProviderConnectionsListOutput = {
  items: {
    object: 'ai_gateway.provider_connection';
    id: string;
    name: string;
    description: string | null;
    priority: number;
    provider: { id: string; slug: string; name: string };
    config: Record<string, string | number | boolean>;
    features: { zdr: boolean };
    pricingOverride: {
      multiplier: number | null;
      models: Record<
        string,
        {
          currency: 'USD';
          text: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          image: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          audio: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          video: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          contextTiers: {
            minInputTokens: number;
            input: number | null;
            output: number | null;
            cacheRead: number | null;
          }[];
          units: {
            modality: 'text' | 'image' | 'audio' | 'video';
            direction: 'input' | 'output';
            unit: string;
            price: number;
          }[];
          webSearchPer1K: number | null;
          conditions: {
            label: string;
            description: string;
            modality: 'text' | 'image' | 'audio' | 'video';
            rates: {
              input: number | null;
              output: number | null;
              cacheRead: number | null;
              cacheWrite: { ttl: string | null; price: number }[];
              reasoning: number | null;
            };
          }[];
        }
      >;
    } | null;
    credentialHint: string | null;
    status: 'pending' | 'valid' | 'invalid' | 'disabled';
    statusMessage: string | null;
    consecutiveFailures: number;
    lastCheckedAt: Date | null;
    lastValidAt: Date | null;
    nextCheckAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceAiGatewayProviderConnectionsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceAiGatewayProviderConnectionsListOutput>(
    [
      7,
      [
        1,
        [
          'pricing_override',
          'credential_hint',
          'status_message',
          'consecutive_failures',
          'last_checked_at',
          'last_valid_at',
          'next_check_at',
          'deleted_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceAiGatewayProviderConnectionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  provider?: string | undefined;
  status?:
    | 'pending'
    | 'valid'
    | 'invalid'
    | 'disabled'
    | ('pending' | 'valid' | 'invalid' | 'disabled')[]
    | undefined;
};

export let mapManagementInstanceAiGatewayProviderConnectionsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceAiGatewayProviderConnectionsListQuery>(
    0
  );
