import type { RuleTestResult } from '@mtsrc/agent-tracking-module-rules';
import type { RuleWithRelations } from '@mtsrc/agent-tracking-module-rules';
import { entityReferencePresenter } from './entity';

export let rulePresenter = (rule: RuleWithRelations) => ({
  object: 'agent_tracking#attribution_rule',

  id: rule.id,
  name: rule.name,
  effect: rule.effect,
  priority: rule.priority,
  enabled: rule.enabled,
  match: rule.match,
  validFrom: rule.validFrom,

  target: entityReferencePresenter(rule.targetEntity),
  scope: {
    projectId: rule.scopeProject?.id ?? null,
    instanceId: rule.scopeInstance?.id ?? null
  },

  archivedAt: rule.archivedAt,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt
});

export let ruleTestPresenter = (result: RuleTestResult) => ({
  object: 'agent_tracking#attribution_rule_test',

  sessionsEvaluated: result.sessionsEvaluated,
  sessionsMatched: result.sessionsMatched,
  sessionsChanged: result.sessionsChanged,
  truncated: result.truncated,

  samples: result.samples
});
