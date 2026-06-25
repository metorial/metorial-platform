import { combineQueueProcessors } from '@lowerdeck/queue';
import { discoverSlateErrorQueueProcessor, discoverSlateQueueProcessor } from './discover';
import {
  rediscoverSlateQueueProcessor,
  rediscoverSlatesCron,
  rediscoverSlatesQueueProcessor
} from './rediscover';

export let discoveryQueues = combineQueueProcessors([
  discoverSlateQueueProcessor,
  discoverSlateErrorQueueProcessor,
  rediscoverSlatesCron,
  rediscoverSlatesQueueProcessor,
  rediscoverSlateQueueProcessor
]);
