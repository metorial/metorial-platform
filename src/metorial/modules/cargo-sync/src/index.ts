import { combineQueueProcessors } from '@metorial/queue';
import { cargoSyncCron, cargoSyncQueueProcessor } from './queue';

export * from './flags';
export * from './actor';
export * from './models';
export * from './ownership';
export * from './queue';
export * from './sync';

export let cargoSyncQueueProcessors = combineQueueProcessors([
  cargoSyncCron,
  cargoSyncQueueProcessor
]);
