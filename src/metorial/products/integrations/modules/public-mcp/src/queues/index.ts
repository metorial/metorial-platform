import { combineQueueProcessors } from '@lowerdeck/queue';
import { publicMcpExpireProcessors } from './expire';
import { publicMcpGrantCleanupProcessors } from './grantCleanup';
import { searchQueues } from './search';
import { publicMcpServerArchivedProcessors } from './serverArchived';

export let publicMcpQueueProcessors = combineQueueProcessors([
  publicMcpExpireProcessors,
  publicMcpGrantCleanupProcessors,
  publicMcpServerArchivedProcessors,
  searchQueues
]);
