import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { checkEdition, isBuilt } from '@metorial/editions';
import { app } from './_app';
import { actorController } from './actor';
import { changeNotificationController } from './changeNotification';
import { codeBucketController } from './codeBucket';
import { scmBackendController } from './scmBackend';
import type { scmBackendTemplateController as ScmBackendTemplateController } from './scmBackendTemplate';
import { scmBackendSetupSessionController } from './scmBackendSetupSession';
import { scmInstallationController } from './scmInstallation';
import { scmInstallationSessionController } from './scmInstallationSession';
import { scmRepoPushController } from './scmRepoPush';
import { scmRepositoryController } from './scmRepository';
import { scmRepositorySyncController } from './scmRepositorySync';
import { tenantController } from './tenant';

let scmBackendTemplateController = (
  checkEdition('on-prem') || !isBuilt()
    ? (await import('./scmBackendTemplate')).scmBackendTemplateController
    : app.controller({})
) as typeof ScmBackendTemplateController;

export let rootController = app.controller({
  tenant: tenantController,
  actor: actorController,

  codeBucket: codeBucketController,

  scmBackend: scmBackendController,
  scmBackendTemplate: scmBackendTemplateController,
  scmBackendSetupSession: scmBackendSetupSessionController,
  scmInstallation: scmInstallationController,
  scmInstallationSession: scmInstallationSessionController,
  scmRepository: scmRepositoryController,
  scmRepositorySync: scmRepositorySyncController,
  scmRepoPush: scmRepoPushController,

  changeNotification: changeNotificationController
});

export let OriginRPC = createServer({})(rootController);
export let originApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-origin' }, [OriginRPC]) }
]);

export type OriginClient = InferClient<typeof rootController>;
