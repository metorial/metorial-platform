import { combineQueueProcessors } from '@metorial/queue';
import { backfillProcessors } from './queues/backfill';
import { mirrorProcessors } from './queues/mirror';
import { indexFirewallQueueProcessor } from './queues/search';

export * from '@lowerdeck/ip-range';
export * from './lib/compileEgress';
export * from './lib/compileNetworkAllowList';
export * from './lib/networkPolicyRules';
export * from './lib/networkPolicyValidation';
export * from './lib/portRangeSet';
export * from './queues/backfill';
export * from './services';

export let networkingQueueProcessor = combineQueueProcessors([
  indexFirewallQueueProcessor,
  mirrorProcessors,
  backfillProcessors
]);
