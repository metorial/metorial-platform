import { combineQueueProcessors } from '@lowerdeck/queue';
import { reconcileProtoGuardFilterMonitorProcessors } from './protoGuardFilterMonitor';

export let reconcileQueues = combineQueueProcessors([
  reconcileProtoGuardFilterMonitorProcessors
]);
