import { combineQueueProcessors } from '@lowerdeck/queue';
import { discoverRemoteOAuthConfigQueueProcessor } from './queues/discovery/remoteOAuthConfig';
import { discoverRemoteOAuthConnectionQueueProcessor } from './queues/discovery/remoteOAuthConnection';
import {
  retryFailedRegistrationsCron,
  retryFailedRegistrationsSearchQueueProcessor,
  retryRegistrationQueueProcessor
} from './queues/discovery/retryRemoteOAuthConnections';
import {
  rotateStaleCredentialsSearchQueueProcessor,
  rotateStaleCredentialsQueueProcessor,
  promoteRotatedCredentialsQueueProcessor
} from './queues/oauth/rotateRemoteCredentials';
import { delegatedOAuthErrorCheckQueueProcessor } from './queues/oauth/delegatedErrorCheck';
import { remoteOAuthErrorCheckQueueProcessor } from './queues/oauth/remoteErrorCheck';

export * from './services';
export * from './services/oauth/delegated';
export * from './services/oauth/serverAuthToken';
export { discoverRemoteOAuthConfigQueue } from './queues/discovery/remoteOAuthConfig';
export { retryFailedRegistrationsSearchQueue } from './queues/discovery/retryRemoteOAuthConnections';
export { rotateStaleCredentialsSearchQueue } from './queues/oauth/rotateRemoteCredentials';

export let oauthQueueProcessor = combineQueueProcessors([
  discoverRemoteOAuthConfigQueueProcessor,
  discoverRemoteOAuthConnectionQueueProcessor,
  retryFailedRegistrationsCron,
  retryFailedRegistrationsSearchQueueProcessor,
  retryRegistrationQueueProcessor,
  rotateStaleCredentialsSearchQueueProcessor,
  rotateStaleCredentialsQueueProcessor,
  promoteRotatedCredentialsQueueProcessor,
  delegatedOAuthErrorCheckQueueProcessor,
  remoteOAuthErrorCheckQueueProcessor
]);
