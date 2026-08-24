import { combineQueueProcessors } from '@lowerdeck/queue';
import { triggerPollQueueProcessor } from './poll';
import {
  triggerScheduleReleaseStaleClaimsCron,
  triggerScheduleSearchCron,
  triggerScheduleSearchQueueProcessor
} from './schedule';
import { triggerRegistrationInstanceSetupQueueProcessor } from './setup';

export let triggerQueues = combineQueueProcessors([
  triggerScheduleSearchCron,
  triggerScheduleReleaseStaleClaimsCron,
  triggerScheduleSearchQueueProcessor,
  triggerPollQueueProcessor,
  triggerRegistrationInstanceSetupQueueProcessor
]);
