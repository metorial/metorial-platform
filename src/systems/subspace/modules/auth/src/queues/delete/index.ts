import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  providerAuthConfigArchivedCleanupCron,
  providerAuthConfigBackendDeleteQueueProcessor,
  providerAuthConfigDeleteManyQueueProcessor,
  providerAuthConfigDeleteQueueProcessor
} from './providerAuthConfig';
import {
  providerAuthCredentialsArchivedCleanupCron,
  providerAuthCredentialsBackendDeleteQueueProcessor,
  providerAuthCredentialsDeleteManyQueueProcessor,
  providerAuthCredentialsDeleteQueueProcessor
} from './providerAuthCredentials';

export let deleteQueues = combineQueueProcessors([
  providerAuthCredentialsArchivedCleanupCron,
  providerAuthCredentialsDeleteManyQueueProcessor,
  providerAuthCredentialsDeleteQueueProcessor,
  providerAuthCredentialsBackendDeleteQueueProcessor,
  providerAuthConfigArchivedCleanupCron,
  providerAuthConfigDeleteManyQueueProcessor,
  providerAuthConfigDeleteQueueProcessor,
  providerAuthConfigBackendDeleteQueueProcessor
]);
