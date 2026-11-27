import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  providerAuthConfigArchivedQueueProcessor,
  providerAuthConfigCreatedQueueProcessor,
  providerAuthConfigDeletedQueueProcessor,
  providerAuthConfigUpdatedQueueProcessor
} from './providerAuthConfig';
import {
  providerAuthCredentialsArchivedQueueProcessor,
  providerAuthCredentialsCreatedQueueProcessor,
  providerAuthCredentialsDeletedQueueProcessor,
  providerAuthCredentialsArchiveAuthConfigsManyQueueProcessor,
  providerAuthCredentialsUpdatedQueueProcessor
} from './providerAuthCredentials';
import {
  providerOAuthSetupCreatedQueueProcessor,
  providerOAuthSetupUpdatedQueueProcessor
} from './providerOAuthSetup';
import {
  providerSetupSessionCreatedQueueProcessor,
  providerSetupSessionUpdatedQueueProcessor
} from './providerSetupSession';

export let lifecycleQueues = combineQueueProcessors([
  providerAuthCredentialsCreatedQueueProcessor,
  providerAuthCredentialsUpdatedQueueProcessor,
  providerAuthCredentialsArchivedQueueProcessor,
  providerAuthCredentialsArchiveAuthConfigsManyQueueProcessor,
  providerAuthCredentialsDeletedQueueProcessor,
  providerAuthConfigCreatedQueueProcessor,
  providerAuthConfigUpdatedQueueProcessor,
  providerAuthConfigArchivedQueueProcessor,
  providerAuthConfigDeletedQueueProcessor,
  providerOAuthSetupCreatedQueueProcessor,
  providerOAuthSetupUpdatedQueueProcessor,
  providerSetupSessionCreatedQueueProcessor,
  providerSetupSessionUpdatedQueueProcessor
]);

export let lifecycleSubspaceQueues = combineQueueProcessors([
  providerAuthCredentialsCreatedQueueProcessor,
  providerAuthCredentialsUpdatedQueueProcessor,
  providerAuthConfigCreatedQueueProcessor,
  providerAuthConfigUpdatedQueueProcessor,
  providerOAuthSetupCreatedQueueProcessor,
  providerOAuthSetupUpdatedQueueProcessor,
  providerSetupSessionCreatedQueueProcessor,
  providerSetupSessionUpdatedQueueProcessor
]);

export let lifecycleFederationQueues = combineQueueProcessors([
  providerAuthCredentialsArchivedQueueProcessor,
  providerAuthCredentialsArchiveAuthConfigsManyQueueProcessor,
  providerAuthCredentialsDeletedQueueProcessor,
  providerAuthConfigArchivedQueueProcessor,
  providerAuthConfigDeletedQueueProcessor
]);
