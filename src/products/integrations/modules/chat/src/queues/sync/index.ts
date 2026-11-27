import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncChatInstanceProviderAuthorizationQueueProcessor } from './authorization';
import {
  syncChatWorkspacesCron,
  syncChatWorkspacesForProviderQueueProcessor,
  syncChatWorkspacesManyQueueProcessor
} from './workspaces';

export let syncQueues = combineQueueProcessors([
  syncChatWorkspacesCron,
  syncChatWorkspacesManyQueueProcessor,
  syncChatWorkspacesForProviderQueueProcessor,
  syncChatInstanceProviderAuthorizationQueueProcessor
]);

export { enqueueSyncChatInstanceProviderAuthorization } from './authorization';
export { enqueueSyncChatWorkspacesForProvider } from './workspaces';

export let syncSubspaceQueues = combineQueueProcessors([
  syncChatInstanceProviderAuthorizationQueueProcessor
]);

export let syncFederationQueues = combineQueueProcessors([
  syncChatWorkspacesCron,
  syncChatWorkspacesManyQueueProcessor,
  syncChatWorkspacesForProviderQueueProcessor
]);
