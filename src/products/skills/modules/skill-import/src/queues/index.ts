import { combineQueueProcessors } from '@metorial/queue';
import { skillImportAcquireQueueProcessor } from './acquire';
import { skillImportDiscoverQueueProcessor } from './discover';
import { skillImportFinishQueueProcessor } from './finish';
import { skillImportItemQueueProcessor } from './item';
import { skillImportRecoveryCron } from './recovery';

export let skillImportQueueProcessor = combineQueueProcessors([
  skillImportAcquireQueueProcessor,
  skillImportDiscoverQueueProcessor,
  skillImportItemQueueProcessor,
  skillImportFinishQueueProcessor,
  skillImportRecoveryCron
]);
