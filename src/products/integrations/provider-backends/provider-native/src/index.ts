import './integrations';

import { combineQueueProcessors } from '@lowerdeck/queue';

export let nativeProviderSubspaceQueues = combineQueueProcessors([]);

export let nativeProviderFederationQueues = combineQueueProcessors([]);

export let nativeProviderQueues = combineQueueProcessors([]);

export * from './impl';
export * from './registry';
export * from './sync';
