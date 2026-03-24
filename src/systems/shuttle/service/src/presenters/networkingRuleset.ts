import type { NetworkingRuleset, Tenant } from '../../prisma/generated/client';

export let networkingRulesetPresenter = (
  networkingRuleset: NetworkingRuleset & {
    tenant: Tenant;
  }
) => ({
  object: 'shuttle#networking_ruleset',

  id: networkingRuleset.id,

  status: networkingRuleset.status,
  name: networkingRuleset.name,
  description: networkingRuleset.description,

  defaultAction: networkingRuleset.rules.defaultAction,
  rules: networkingRuleset.rules.rules,

  tenantId: networkingRuleset.tenant.id,

  createdAt: networkingRuleset.createdAt
});
