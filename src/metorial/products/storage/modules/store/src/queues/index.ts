import { combineQueueProcessors } from '@metorial/queue';
import { storeLifecycleProcessors } from './lifecycle';
import { storeCleanupProcessors } from './storeCleanup';
import { storeParticipantBackfillProcessors } from './storeParticipantBackfill';
import { storeTemplateSyncProcessors } from './storeTemplateSync';
import { storeVersionProcessors } from './storeVersion';

export * from './lifecycle';
export * from './storeCleanup';
export * from './storeParticipantBackfill';
export * from './storeTemplateSync';
export * from './storeVersion';

export let storeQueueProcessor = combineQueueProcessors([
  storeLifecycleProcessors,
  storeCleanupProcessors,
  storeParticipantBackfillProcessors,
  storeTemplateSyncProcessors,
  storeVersionProcessors
]);
