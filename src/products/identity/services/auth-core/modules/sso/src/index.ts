import { combineQueueProcessors } from '@lowerdeck/queue';
import { disableSsoDirectoryUsersProcessor } from './queues/disableSsoDirectoryUsers';
import { reconcileSsoGroupRoleMembershipsProcessor } from './queues/reconcileSsoGroupRoleMemberships';
import { reconcileSsoUsersProcessor } from './queues/reconcileSsoUsers';
import { recordSsoUserChangesProcessor } from './queues/recordSsoUserChanges';
import { syncImportedDelegationsProcessor } from './queues/syncImportedDelegations';
import { ssoCleanupCron } from './cron/cleanup';

export * from './lib/jackson';
export * from './queues/disableSsoDirectoryUsers';
export * from './queues/reconcileSsoGroupRoleMemberships';
export * from './queues/reconcileSsoUsers';
export * from './queues/recordSsoUserChanges';
export * from './queues/syncImportedDelegations';
export * from './services/connection/connection';
export * from './services/connection/directory';
export * from './services/connection/setup';
export * from './services/connection/tenant';
export * from './services/delegation/delegation';
export * from './services/delegation/delegationClient';
export * from './services/identity/directorySync';
export * from './services/identity/groupRole';
export * from './services/identity/identity';
export * from './services/identity/types';
export * from './services/identity/utils';
export * from './services/login/auth';
export * from './services/login/authRedirect';
export * from './services/login/authStart';
export * from './services/login/elevation';
export * from './services/login/login';

export let ssoQueueProcessor = combineQueueProcessors([
  disableSsoDirectoryUsersProcessor,
  reconcileSsoGroupRoleMembershipsProcessor,
  reconcileSsoUsersProcessor,
  recordSsoUserChangesProcessor,
  syncImportedDelegationsProcessor,
  ssoCleanupCron
]);
