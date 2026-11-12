import { combineQueueProcessors } from '@lowerdeck/queue';
import { eraseTenantRecordsProcessor } from './eraseRecords';

export { eraseTenantRecordsQueue, storeCollections } from './eraseRecords';

export let groundstationQueues = combineQueueProcessors([eraseTenantRecordsProcessor]);
