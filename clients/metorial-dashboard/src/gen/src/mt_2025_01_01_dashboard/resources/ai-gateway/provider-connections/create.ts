import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AiGatewayProviderConnectionsCreateOutput = {
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
};

export let mapAiGatewayProviderConnectionsCreateOutput =
  /* @__PURE__ */ mapObject<AiGatewayProviderConnectionsCreateOutput>(
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
    ],
    1
  );

export type AiGatewayProviderConnectionsCreateBody = {
  provider: string;
  name: string;
  description?: string | null | undefined;
  priority?: number | undefined;
  credentials: Record<string, string>;
  config?: Record<string, string | number | boolean> | undefined;
  features?: { zdr?: boolean | undefined } | undefined;
  pricingOverride?:
    | {
        multiplier?: number | undefined;
        models?:
          | Record<
              string,
              {
                currency: 'USD';
                text?:
                  | {
                      input?: number | null | undefined;
                      output?: number | null | undefined;
                      cacheRead?: number | null | undefined;
                      cacheWrite?:
                        | { ttl?: string | null | undefined; price: number }[]
                        | undefined;
                      reasoning?: number | null | undefined;
                    }
                  | null
                  | undefined;
                image?:
                  | {
                      input?: number | null | undefined;
                      output?: number | null | undefined;
                      cacheRead?: number | null | undefined;
                      cacheWrite?:
                        | { ttl?: string | null | undefined; price: number }[]
                        | undefined;
                      reasoning?: number | null | undefined;
                    }
                  | null
                  | undefined;
                audio?:
                  | {
                      input?: number | null | undefined;
                      output?: number | null | undefined;
                      cacheRead?: number | null | undefined;
                      cacheWrite?:
                        | { ttl?: string | null | undefined; price: number }[]
                        | undefined;
                      reasoning?: number | null | undefined;
                    }
                  | null
                  | undefined;
                video?:
                  | {
                      input?: number | null | undefined;
                      output?: number | null | undefined;
                      cacheRead?: number | null | undefined;
                      cacheWrite?:
                        | { ttl?: string | null | undefined; price: number }[]
                        | undefined;
                      reasoning?: number | null | undefined;
                    }
                  | null
                  | undefined;
                contextTiers?:
                  | {
                      minInputTokens: number;
                      input?: number | null | undefined;
                      output?: number | null | undefined;
                      cacheRead?: number | null | undefined;
                    }[]
                  | undefined;
                units?:
                  | {
                      modality: 'text' | 'image' | 'audio' | 'video';
                      direction: 'input' | 'output';
                      unit: string;
                      price: number;
                    }[]
                  | undefined;
                webSearchPer1K?: number | null | undefined;
              }
            >
          | undefined;
      }
    | null
    | undefined;
};

export let mapAiGatewayProviderConnectionsCreateBody =
  /* @__PURE__ */ mapObject<AiGatewayProviderConnectionsCreateBody>([
    'pricing_override'
  ]);
