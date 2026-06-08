import { combineQueueProcessors } from '@metorial/queue';
import {
  syncPluginsCron,
  syncPluginsManyQueueProcessor,
  syncPluginsSingleQueueProcessor
} from './queues/syncPlugins';

export { purposeSlugs } from './definitions';
export * from './instanceAccess';
export * from './services';
export * from './storage';

export let fileQueueProcessor = combineQueueProcessors([
  syncPluginsCron,
  syncPluginsManyQueueProcessor,
  syncPluginsSingleQueueProcessor
]);
