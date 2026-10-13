import { combineQueueProcessors } from '@lowerdeck/queue';
import { enclaveCreatedQueueProcessor, enclaveUpdatedQueueProcessor } from './enclave';
import { firewallUpdatedQueueProcessor } from './firewall';
import {
  firewallAssignmentCreatedQueueProcessor,
  firewallAssignmentDeletedQueueProcessor
} from './firewallAssignment';
import { internetGatewayCreatedQueueProcessor } from './internetGateway';
import { networkPolicyUpdatedQueueProcessor } from './networkPolicy';

export let lifecycleQueues = combineQueueProcessors([
  enclaveCreatedQueueProcessor,
  enclaveUpdatedQueueProcessor,
  internetGatewayCreatedQueueProcessor,
  firewallUpdatedQueueProcessor,
  firewallAssignmentCreatedQueueProcessor,
  firewallAssignmentDeletedQueueProcessor,
  networkPolicyUpdatedQueueProcessor
]);
