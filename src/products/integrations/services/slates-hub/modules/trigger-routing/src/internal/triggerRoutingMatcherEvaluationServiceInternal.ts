import { Service } from '@lowerdeck/service';
import type { SlatesTriggerRoutingMatcher } from '@slates/proto';
import type { SlateWebhookRegistration } from '@mtsrc/slates-hub-db/client';
import { db } from '@mtsrc/slates-hub-db/db';
import { getId } from '@mtsrc/slates-hub-db/id';

class TriggerRoutingMatcherEvaluationServiceInternalImpl {
  async recordEvaluations(d: {
    webhookRegistration: Pick<
      SlateWebhookRegistration,
      'oid' | 'tenantOid' | 'triggerGroupOid'
    >;
    evaluations: { hash: string; values: SlatesTriggerRoutingMatcher; matched: boolean }[];
  }) {
    if (d.evaluations.length === 0) return;

    await db.triggerRoutingMatcherEvaluation.createMany({
      data: d.evaluations.map(evaluation => ({
        ...getId('triggerRoutingMatcherEvaluation'),
        tenantOid: d.webhookRegistration.tenantOid,
        webhookRegistrationOid: d.webhookRegistration.oid,
        triggerGroupOid: d.webhookRegistration.triggerGroupOid,
        hash: evaluation.hash,
        matcher: evaluation.values,
        matched: evaluation.matched
      }))
    });
  }
}

export let triggerRoutingMatcherEvaluationServiceInternal = Service.create(
  'triggerRoutingMatcherEvaluationServiceInternal',
  () => new TriggerRoutingMatcherEvaluationServiceInternalImpl()
).build();
