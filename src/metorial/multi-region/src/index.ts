import { combineQueueProcessors } from '@metorial/queue';
import { fromDeploymentSyncProcessors } from './sync/fromDeployment';
import { toDeploymentSyncProcessors } from './sync/toDeployment';

export * from './cell';
export * from './repositories';

export let multiRegionQueueProcessor = combineQueueProcessors([
  toDeploymentSyncProcessors,
  fromDeploymentSyncProcessors
]);

export * from './db';
