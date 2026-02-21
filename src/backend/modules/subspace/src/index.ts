import { combineQueueProcessors } from '@metorial/queue';

export let subspaceQueueProcessor = combineQueueProcessors([]);

export * from './proxy';
export * from './services';

export { getTenantForSubspace } from './subspace';
