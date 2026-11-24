import type { PlatformConnectionDefinition } from '@mtsrc/ai-gateway-module-credentials';
import type { Pricing } from '@mtsrc/ai-gateway-spec';

let slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type RoutingRuleDefinition = {
  slug: string;
  labSlug: string | null;
  modelSlug: string | null;
  connection: PlatformConnectionDefinition;
  priority: number;
  weight: number;
  pricingOverride: Pricing | null;
};

type RoutingRuleTarget = { lab: string; model?: never } | { model: string; lab?: never };

export let routingRule = (
  d: RoutingRuleTarget & {
    slug: string;
    via: PlatformConnectionDefinition;
    priority?: number;
    weight?: number;
    pricingOverride?: Pricing;
  }
): RoutingRuleDefinition => {
  let priority = d.priority ?? 0;
  let weight = d.weight ?? 1;

  if (!slugPattern.test(d.slug)) {
    throw new Error(`Routing rule slug "${d.slug}" must be lowercase kebab-case.`);
  }
  if (!Number.isInteger(priority)) {
    throw new Error(`Routing rule "${d.slug}" needs an integer priority.`);
  }
  if (!Number.isInteger(weight) || weight < 1) {
    throw new Error(`Routing rule "${d.slug}" needs an integer weight of at least 1.`);
  }

  return {
    slug: d.slug,
    labSlug: d.lab ?? null,
    modelSlug: d.model ?? null,
    connection: d.via,
    priority,
    weight,
    pricingOverride: d.pricingOverride ?? null
  };
};

export let validateRoutingRules = (d: {
  rules: RoutingRuleDefinition[];
  connections: PlatformConnectionDefinition[];
}) => {
  let connectionSlugs = new Set(d.connections.map(connection => connection.slug));
  let seen = new Set<string>();

  for (let rule of d.rules) {
    if (seen.has(rule.slug)) throw new Error(`Routing rule "${rule.slug}" is defined twice.`);
    seen.add(rule.slug);

    if (!connectionSlugs.has(rule.connection.slug)) {
      throw new Error(
        `Routing rule "${rule.slug}" routes via "${rule.connection.slug}", which is not a defined platform connection.`
      );
    }
  }
};
