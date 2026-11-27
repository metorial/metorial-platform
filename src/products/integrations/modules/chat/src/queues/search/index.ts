import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexChatChildrenManyQueueProcessor, indexChatQueueProcessor } from './chat';
import { indexChatChannelQueueProcessor } from './chatChannel';
import { indexChatConnectionQueueProcessor } from './chatConnection';
import { indexChatConnectionProviderQueueProcessor } from './chatConnectionProvider';
import { indexChatInstanceQueueProcessor } from './chatInstance';
import {
  indexChatInstanceProviderQueueProcessor,
  indexChatInstanceProvidersManyQueueProcessor
} from './chatInstanceProvider';
import { indexChatWorkspaceQueueProcessor } from './chatWorkspace';

export let searchQueues = combineQueueProcessors([
  indexChatQueueProcessor,
  indexChatChildrenManyQueueProcessor,
  indexChatChannelQueueProcessor,
  indexChatConnectionQueueProcessor,
  indexChatConnectionProviderQueueProcessor,
  indexChatInstanceQueueProcessor,
  indexChatInstanceProviderQueueProcessor,
  indexChatInstanceProvidersManyQueueProcessor,
  indexChatWorkspaceQueueProcessor
]);
