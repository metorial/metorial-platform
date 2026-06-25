import { combineQueueProcessors } from '@metorial/queue';
import { fromDeploymentSyncProcessors } from './sync/fromDeployment';
import { toDeploymentSyncProcessors } from './sync/toDeployment';

export * from './repositories';
export * from './cell';

export let multiRegionQueueProcessor = combineQueueProcessors([
  toDeploymentSyncProcessors,
  fromDeploymentSyncProcessors
]);

export type { Cell, CellToken } from './db';
