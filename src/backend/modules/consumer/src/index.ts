import { combineQueueProcessors } from '@metorial/queue';

export * from './definitions/accessRoles';

export let consumerQueueProcessor = combineQueueProcessors([]);
