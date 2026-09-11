import { createLoader } from '@metorial-io/data-hooks';
import { adminClient, withAuthRedirect } from '../hooks/client.js';
import { usePaginatedLoader } from './usePaginatedLoader.js';

export let triggerRoutingMatcherEvaluationsLoader = createLoader({
  name: 'triggerRoutingMatcherEvaluations',
  fetch: (params: { webhookRegistrationId: string; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.triggerRoutingMatcherEvaluation.list(params)),
  mutators: {}
});

export let useTriggerRoutingMatcherEvaluations = (webhookRegistrationId: string | undefined) =>
  usePaginatedLoader(
    triggerRoutingMatcherEvaluationsLoader,
    webhookRegistrationId ? { webhookRegistrationId } : null
  );
