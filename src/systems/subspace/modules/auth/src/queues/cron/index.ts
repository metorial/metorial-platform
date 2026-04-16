import { combineQueueProcessors } from '@lowerdeck/queue';
import { expireOAuthSetupCron } from './expireOAuthSetup';
import {
  reconcileProviderAuthConfigScopesCron,
  reconcileProviderAuthConfigScopesQueueProcessor,
  reconcileProviderAuthCredentialsScopesCron,
  reconcileProviderAuthCredentialsScopesQueueProcessor
} from './reconcileScopes';

export let cronQueues = combineQueueProcessors([
  expireOAuthSetupCron,
  reconcileProviderAuthConfigScopesCron,
  reconcileProviderAuthConfigScopesQueueProcessor,
  reconcileProviderAuthCredentialsScopesCron,
  reconcileProviderAuthCredentialsScopesQueueProcessor
]);
