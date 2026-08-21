import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  syncChatWorkspacesCron,
  syncChatWorkspacesForProviderQueueProcessor,
  syncChatWorkspacesManyQueueProcessor
} from './workspaces';

export let syncQueues = combineQueueProcessors([
  syncChatWorkspacesCron,
  syncChatWorkspacesManyQueueProcessor,
  syncChatWorkspacesForProviderQueueProcessor
]);

export { enqueueSyncChatWorkspacesForProvider } from './workspaces';
