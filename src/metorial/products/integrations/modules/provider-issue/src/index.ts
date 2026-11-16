import { combineQueueProcessors } from '@lowerdeck/queue';
import { providerIssueBackfillProcessors } from './queues/backfill';

export * from './services';

export let providerIssueQueueProcessor = combineQueueProcessors([
  providerIssueBackfillProcessors
]);
