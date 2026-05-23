import { combineQueueProcessors } from '@mtsrc/queue';
import { storeLifecycleProcessors } from './lifecycle';
import { storeCleanupProcessors } from './storeCleanup';
import { storeTemplateSyncProcessors } from './storeTemplateSync';
import { storeVersionProcessors } from './storeVersion';

export * from './lifecycle';
export * from './storeCleanup';
export * from './storeTemplateSync';
export * from './storeVersion';

export let storeQueueProcessor = combineQueueProcessors([
  storeLifecycleProcessors,
  storeCleanupProcessors,
  storeTemplateSyncProcessors,
  storeVersionProcessors
]);
