import { v, type ValidationTypeValue } from '@lowerdeck/validation';

export let gatewayLimitMetrics = ['requests', 'tokens', 'spend_usd'] as const;
export let gatewayLimitIntervals = ['1m', '1h', '1d', '1mo'] as const;

export let maxGatewayLimits = 12;

export type GatewayLimitMetric = (typeof gatewayLimitMetrics)[number];
export type GatewayLimitInterval = (typeof gatewayLimitIntervals)[number];

export let gatewayLimitSchema = v.object({
  metric: v.enumOf(gatewayLimitMetrics),
  amount: v.number({ modifiers: [v.positive()] }),
  interval: v.enumOf(gatewayLimitIntervals)
});

export let gatewayLimitsSchema = v.array(gatewayLimitSchema, {
  modifiers: [v.maxLength(maxGatewayLimits)]
});

export type GatewayLimit = ValidationTypeValue<typeof gatewayLimitSchema>;

// Platform limits come from Metorial's plans (e.g. free projects get N tokens a day). Requests
// and tokens count all of a project's traffic; spend only counts what Metorial bills, because
// traffic over the customer's own provider keys costs Metorial nothing.
export let platformLimitMetrics = ['requests', 'tokens', 'metorial_spend_usd'] as const;

export type PlatformLimitMetric = (typeof platformLimitMetrics)[number];

export let platformLimitSchema = v.object({
  metric: v.enumOf(platformLimitMetrics),
  amount: v.number({ modifiers: [v.minValue(0)] }),
  intervalSeconds: v.number({
    modifiers: [v.integer(), v.minValue(1), v.maxValue(60 * 60 * 24)]
  })
});

export let platformLimitsSchema = v.array(platformLimitSchema, {
  modifiers: [v.maxLength(20)]
});

export type PlatformLimit = ValidationTypeValue<typeof platformLimitSchema>;
