import { combineQueueProcessors } from '@lowerdeck/queue';
import { rebuildProcessor } from './rebuild';

export let rebuildQueueProcessor = combineQueueProcessors([rebuildProcessor]);
