import { combineQueueProcessors } from '@lowerdeck/queue';
import { createBranchRepositorySyncQueueProcessor } from './createBranch';
import { createPrRepositorySyncQueueProcessor } from './createPr';
import { mergeRepositorySyncQueueProcessor } from './merge';
import { startRepositorySyncQueueProcessor } from './start';
import { syncContentsRepositorySyncQueueProcessor } from './syncContents';
import { waitForCiRepositorySyncQueueProcessor } from './waitForCi';

export let repositorySyncQueueProcessor = combineQueueProcessors([
  startRepositorySyncQueueProcessor,
  createBranchRepositorySyncQueueProcessor,
  syncContentsRepositorySyncQueueProcessor,
  createPrRepositorySyncQueueProcessor,
  waitForCiRepositorySyncQueueProcessor,
  mergeRepositorySyncQueueProcessor
]);
