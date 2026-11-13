import { combineQueueProcessors } from '@lowerdeck/queue';
import { archiveEphemeralDevicesProcessor } from './archiveEphemeralDevices';
import { eraseEntitiesProcessor } from './eraseEntities';
import { eraseRecordsProcessor } from './eraseRecords';
import { eraseUserProcessor } from './eraseUser';
import { mergeSuggestionsProcessor } from './mergeSuggestions';
import { reattributeProcessor } from './reattribute';
import { rebuildProcessor } from './rebuild';
import { sessionClassifyProcessor } from './sessionClassify';
import { sessionlessSlicesProcessor } from './sessionlessSlices';
import { sessionReconcileProcessor } from './sessionReconcile';
import { sessionSettleProcessor } from './sessionSettle';
import { sessionStateProcessor } from './sessionState';

export { eraseEntitiesQueue, type EntityErasureScope } from './eraseEntities';

export {
  eraseCollections,
  eraseFilter,
  eraseRecordsQueue,
  eraseScopeRecords,
  planScopeErasure,
  type EraseScope
} from './eraseRecords';

export let groundstationQueues = combineQueueProcessors([
  eraseRecordsProcessor,
  eraseEntitiesProcessor,
  mergeSuggestionsProcessor,
  archiveEphemeralDevicesProcessor,
  sessionClassifyProcessor,
  reattributeProcessor,
  sessionSettleProcessor,
  sessionStateProcessor,
  sessionReconcileProcessor,
  sessionlessSlicesProcessor,
  rebuildProcessor,
  eraseUserProcessor
]);
