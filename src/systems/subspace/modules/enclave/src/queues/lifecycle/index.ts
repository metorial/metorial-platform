import { combineQueueProcessors } from '@lowerdeck/queue';
import { enclaveCreatedQueueProcessor, enclaveUpdatedQueueProcessor } from './enclave';
import {
  firewallCreatedQueueProcessor,
  firewallDeletedQueueProcessor,
  firewallUpdatedQueueProcessor
} from './firewall';
import {
  firewallBindingCreatedQueueProcessor,
  firewallBindingDeletedQueueProcessor
} from './firewallBinding';
import { firewallNetworkPolicyLinksUpdatedQueueProcessor } from './firewallNetworkPolicy';
import { networkCreatedQueueProcessor } from './network';
import {
  networkPolicyCreatedQueueProcessor,
  networkPolicyDeletedQueueProcessor,
  networkPolicyUpdatedQueueProcessor
} from './networkPolicy';

export let lifecycleQueues = combineQueueProcessors([
  enclaveCreatedQueueProcessor,
  enclaveUpdatedQueueProcessor,
  networkCreatedQueueProcessor,
  firewallCreatedQueueProcessor,
  firewallUpdatedQueueProcessor,
  firewallDeletedQueueProcessor,
  firewallBindingCreatedQueueProcessor,
  firewallBindingDeletedQueueProcessor,
  firewallNetworkPolicyLinksUpdatedQueueProcessor,
  networkPolicyCreatedQueueProcessor,
  networkPolicyUpdatedQueueProcessor,
  networkPolicyDeletedQueueProcessor
]);
