import { env as portalEnv, isAllowedPortalOriginForTemplate } from '@metorial/module-portal';
import { createServer, InferClient, rpcMux } from '@metorial/rpc';
import { authController } from './controllers/auth';
import { bootController } from './controllers/boot';
import { publicApp } from './group';

let rootController = publicApp.controller({
  boot: bootController,
  auth: authController
});

export let customPortalRPC = createServer({})(rootController);

export type CustomPortalClient = InferClient<typeof rootController>;

export let customPortalApi = rpcMux(
  {
    cors:
      process.env.ALLOW_CORS == 'true'
        ? { check: () => true }
        : {
            check: origin =>
              isAllowedPortalOriginForTemplate({
                template: portalEnv.portal.PORTAL_HOST_TEMPLATE,
                origin
              })
          },
    path: '/portal-api'
  },
  [customPortalRPC]
);
