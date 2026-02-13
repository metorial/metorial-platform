import { combineQueueProcessors } from '@metorial/queue';

export let subspaceQueueProcessor = combineQueueProcessors([]);

export * from './services';
export {
  getSubspaceConnectionUrl,
  getSubspaceSolutionIdentifier,
  getTenantForSubspace
} from './subspace';
