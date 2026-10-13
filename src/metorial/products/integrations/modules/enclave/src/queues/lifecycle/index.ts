import { combineQueueProcessors } from '@lowerdeck/queue';
import { enclaveCreatedQueueProcessor, enclaveUpdatedQueueProcessor } from './enclave';
import { firewallUpdatedQueueProcessor } from './firewall';
import {
  firewallBindingCreatedQueueProcessor,
  firewallBindingDeletedQueueProcessor
} from './firewallBinding';
import { networkCreatedQueueProcessor } from './network';
import { networkPolicyUpdatedQueueProcessor } from './networkPolicy';

export let lifecycleQueues = combineQueueProcessors([
  enclaveCreatedQueueProcessor,
  enclaveUpdatedQueueProcessor,
  networkCreatedQueueProcessor,
  firewallUpdatedQueueProcessor,
  firewallBindingCreatedQueueProcessor,
  firewallBindingDeletedQueueProcessor,
  networkPolicyUpdatedQueueProcessor
]);
