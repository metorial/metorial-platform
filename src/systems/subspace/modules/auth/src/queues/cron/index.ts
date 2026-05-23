import { combineQueueProcessors } from '@mtsrc/queue';
import { expireOAuthSetupCron } from './expireOAuthSetup';
import {
  reconcileProviderAuthConfigScopesCron,
  reconcileProviderAuthConfigScopesManyQueueProcessor,
  reconcileProviderAuthConfigScopesQueueProcessor,
  reconcileProviderAuthCredentialsScopesCron,
  reconcileProviderAuthCredentialsScopesManyQueueProcessor,
  reconcileProviderAuthCredentialsScopesQueueProcessor
} from './reconcileScopes';

export let cronQueues = combineQueueProcessors([
  expireOAuthSetupCron,
  reconcileProviderAuthConfigScopesCron,
  reconcileProviderAuthConfigScopesQueueProcessor,
  reconcileProviderAuthCredentialsScopesCron,
  reconcileProviderAuthCredentialsScopesQueueProcessor,
  reconcileProviderAuthConfigScopesManyQueueProcessor,
  reconcileProviderAuthCredentialsScopesManyQueueProcessor
]);
