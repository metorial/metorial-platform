import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  deleteIdentitiesForActorManyQueueProcessor,
  deleteIdentitiesForActorSingleQueueProcessor
} from './identity';

export let archiveQueues = combineQueueProcessors([
  deleteIdentitiesForActorManyQueueProcessor,
  deleteIdentitiesForActorSingleQueueProcessor
]);
