import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlateWebhookRegistration } from '../../prisma/generated/client';
import { db } from '../db';

class TriggerRoutingMatcherEvaluationServiceImpl {
  async listMatcherEvaluations(d: {
    webhookRegistration: Pick<SlateWebhookRegistration, 'oid'>;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.triggerRoutingMatcherEvaluation.findMany({
            ...opts,
            where: { webhookRegistrationOid: d.webhookRegistration.oid },
            orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }]
          })
      )
    );
  }
}

export let triggerRoutingMatcherEvaluationService = Service.create(
  'triggerRoutingMatcherEvaluationService',
  () => new TriggerRoutingMatcherEvaluationServiceImpl()
).build();
