import { combineQueueProcessors } from '@lowerdeck/queue';
import { storeCleanupProcessors } from './storeCleanup';
import { storeTemplateSyncProcessors } from './storeTemplateSync';
import { storeVersionProcessors } from './storeVersion';

export * from './storeCleanup';
export * from './storeTemplateSync';
export * from './storeVersion';

export let storeQueueProcessor = combineQueueProcessors([
  storeCleanupProcessors,
  storeTemplateSyncProcessors,
  storeVersionProcessors
]);
