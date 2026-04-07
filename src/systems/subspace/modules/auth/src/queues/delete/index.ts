import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  providerAuthConfigArchivedCleanupCron,
  providerAuthConfigDeleteManyQueueProcessor,
  providerAuthConfigDeleteQueueProcessor
} from './providerAuthConfig';
import {
  providerAuthCredentialsArchivedCleanupCron,
  providerAuthCredentialsDeleteManyQueueProcessor,
  providerAuthCredentialsDeleteQueueProcessor
} from './providerAuthCredentials';

export let deleteQueues = combineQueueProcessors([
  providerAuthCredentialsArchivedCleanupCron,
  providerAuthCredentialsDeleteManyQueueProcessor,
  providerAuthCredentialsDeleteQueueProcessor,
  providerAuthConfigArchivedCleanupCron,
  providerAuthConfigDeleteManyQueueProcessor,
  providerAuthConfigDeleteQueueProcessor
]);
