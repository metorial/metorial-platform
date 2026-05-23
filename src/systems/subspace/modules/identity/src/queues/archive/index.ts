import { combineQueueProcessors } from '@mtsrc/queue';
import {
  deleteIdentitiesForActorManyQueueProcessor,
  deleteIdentitiesForActorSingleQueueProcessor
} from './identity';

export let archiveQueues = combineQueueProcessors([
  deleteIdentitiesForActorManyQueueProcessor,
  deleteIdentitiesForActorSingleQueueProcessor
]);
