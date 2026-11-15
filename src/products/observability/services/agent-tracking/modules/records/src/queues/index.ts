import { combineQueueProcessors } from '@lowerdeck/queue';
import { eraseRecordsProcessor } from './eraseRecords';

export let recordsQueueProcessor = combineQueueProcessors([eraseRecordsProcessor]);
