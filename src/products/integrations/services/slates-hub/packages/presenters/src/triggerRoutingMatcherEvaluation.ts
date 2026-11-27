import type { TriggerRoutingMatcherEvaluation } from '@mtsrc/slates-hub-db/client';

export let triggerRoutingMatcherEvaluationPresenter = (
  evaluation: TriggerRoutingMatcherEvaluation
) => ({
  object: 'slate.trigger_routing_matcher_evaluation',

  id: evaluation.id,

  matcher: evaluation.matcher,
  matched: evaluation.matched,

  createdAt: evaluation.createdAt
});
