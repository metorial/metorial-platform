import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  linkFunctionBayTenantSingleProcessor,
  linkFunctionBayTenantsCron,
  linkFunctionBayTenantsManyProcessor
} from './linkFunctionBayTenants';

export let tenantsQueues = combineQueueProcessors([
  linkFunctionBayTenantsCron,
  linkFunctionBayTenantsManyProcessor,
  linkFunctionBayTenantSingleProcessor
]);
