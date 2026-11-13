import { combineQueueProcessors } from '@lowerdeck/queue';
import { sessionClassifyProcessor } from './sessionClassify';

export let classificationQueueProcessor = combineQueueProcessors([sessionClassifyProcessor]);
