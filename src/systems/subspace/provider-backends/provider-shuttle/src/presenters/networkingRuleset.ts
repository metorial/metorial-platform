import type { NetworkingRuleset } from '../client';

export let networkingRulesetPresenter = (ruleset: NetworkingRuleset) => ({
  object: 'networking_ruleset',

  id: ruleset.id,
  status: ruleset.status,
  name: ruleset.name,
  description: ruleset.description,
  defaultAction: ruleset.defaultAction,
  rules: ruleset.rules.map(r => ({
    ...r,
    object: 'networking_ruleset.rule'
  })),
  createdAt: ruleset.createdAt
});
