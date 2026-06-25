import { isAllowedPortalOriginForTemplate, env as portalEnv } from '@metorial/module-consumer';
import { getConfig } from '@metorial/config';
import { createServer, InferClient, rpcMux } from '@metorial/rpc';
import { authController } from './controllers/auth';
import { bootController } from './controllers/boot';
import { pluginOAuthSelectionController } from './controllers/pluginOAuthSelection';
import { publicApp } from './group';

let rootController = publicApp.controller({
  boot: bootController,
  auth: authController,
  pluginOAuthSelection: pluginOAuthSelectionController
});

export let customPortalRPC = createServer({})(rootController);

export type CustomPortalClient = InferClient<typeof rootController>;

export let customPortalApi = rpcMux(
  {
    cors:
      process.env.ALLOW_CORS == 'true'
        ? { check: () => true }
        : {
            check: origin => {
              let portalsOrigin = new URL(getConfig().urls.portalsUrl).origin;
              if (origin == portalsOrigin) return true;

              return isAllowedPortalOriginForTemplate({
                template: portalEnv.portal.PORTAL_HOST_TEMPLATE,
                origin
              });
            }
          },
    path: '/portal-api'
  },
  [customPortalRPC]
);
