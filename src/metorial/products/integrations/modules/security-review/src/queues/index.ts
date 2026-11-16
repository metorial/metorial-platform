import { combineQueueProcessors } from '@lowerdeck/queue';
import { securityReviewGlobalProcessors } from './globalSync';
import { runSecurityReviewQueueProcessor } from './run';
import { securityReviewTriggerProcessors } from './triggers';
import { securityReviewUsageRollupProcessors } from './usageRollup';
import { securityReviewUsageScanProcessors } from './usageScan';

export { enqueueSecurityReview } from './run';

export let securityReviewSubspaceQueueProcessor = combineQueueProcessors([
  runSecurityReviewQueueProcessor,
  securityReviewTriggerProcessors,
  securityReviewGlobalProcessors,
  securityReviewUsageRollupProcessors,
  securityReviewUsageScanProcessors
]);
