import { combineQueueProcessors } from '@lowerdeck/queue';
import { archiveEphemeralDevicesProcessor } from './archiveEphemeralDevices';
import { eraseEntitiesProcessor } from './eraseEntities';
import { mergeSuggestionsProcessor } from './mergeSuggestions';

export let entitiesQueueProcessor = combineQueueProcessors([
  archiveEphemeralDevicesProcessor,
  eraseEntitiesProcessor,
  mergeSuggestionsProcessor
]);
