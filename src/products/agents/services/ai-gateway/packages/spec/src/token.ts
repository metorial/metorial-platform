import { v, type ValidationTypeValue } from '@lowerdeck/validation';

export let maxTokenMetadataEntries = 20;

export let gatewayTokenLimitsSchema = v.object({
  requestsPerMinute: v.optional(v.number({ modifiers: [v.positive(), v.integer()] })),
  tokensPerMinute: v.optional(v.number({ modifiers: [v.positive(), v.integer()] })),
  monthlySpendLimitUsd: v.optional(v.number({ modifiers: [v.positive()] }))
});

export type GatewayTokenLimits = ValidationTypeValue<typeof gatewayTokenLimitsSchema>;

export let defaultGatewayTokenLimits: GatewayTokenLimits = {};

export let gatewayTokenMetadataSchema = v.record(v.string({ modifiers: [v.maxLength(256)] }));

export type GatewayTokenMetadata = Record<string, string>;
