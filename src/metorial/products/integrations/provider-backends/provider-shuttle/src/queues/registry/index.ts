import { combineQueueProcessors } from '@lowerdeck/queue';
import { setReadmeForShuttleServerQueueProcessor } from './setReadme';
import {
  syncServersCron,
  syncServersManyProcessor,
  syncServersRegProcessor,
  syncServersSingleProcessor
} from './syncServers';

export let registryQueues = combineQueueProcessors([
  syncServersCron,
  syncServersRegProcessor,
  syncServersManyProcessor,
  syncServersSingleProcessor,
  setReadmeForShuttleServerQueueProcessor
]);
