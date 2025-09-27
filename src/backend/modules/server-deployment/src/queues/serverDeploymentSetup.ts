import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getSentry } from '@metorial/sentry';

let Sentry = getSentry();

export let serverDeploymentSetupQueue = createQueue<{
  serverDeploymentId: string;
  tryNumber?: number;
}>({
  name: 'srd/dep/setup'
});

// class OAuthSetupError extends Error {
//   constructor(
//     public readonly code: string,
//     message: string
//   ) {
//     super(message);
//   }
// }

// const MAX_TRIES = 5;

export let serverDeploymentSetupQueueProcessor = serverDeploymentSetupQueue.process(
  async data => {
    let serverDeployment = await db.serverDeployment.findUnique({
      where: { id: data.serverDeploymentId },
      include: {
        instance: { include: { organization: true } },
        server: true,
        serverImplementation: true
      }
    });
    if (!serverDeployment) throw new Error('retry ... not found');

    let tryNumber = data.tryNumber ?? 1;

    let instance = serverDeployment.instance;
    let organization = instance.organization;

    if (serverDeployment.status != 'active') return;

    // let system = await organizationActorService.getSystemActor({ organization });

    // if (serverDeployment.isOauthConnectionPending) {
    //   try {
    //     let oauthConfig = await db.providerOAuthConfig.findUniqueOrThrow({
    //       where: { oid: serverDeployment.oauthConfigOid! }
    //     });

    //     let autoReg = await providerOauthDiscoveryService.autoRegisterForOauthConfig({
    //       config: oauthConfig.config,
    //       clientName: organization.name
    //     });
    //     if (!autoReg)
    //       throw new OAuthSetupError(
    //         'auto_registration_failed',
    //         'Provider does not support auto registration'
    //       );

    //     let connection = await providerOauthConnectionService.createConnection({
    //       organization,
    //       instance,
    //       performedBy: system,

    //       input: {
    //         name: `OAuth Connection for ${serverDeployment.name ?? serverDeployment.serverImplementation.name ?? serverDeployment.server.name}`,
    //         description: 'Auto-created by Metorial for server deployment',
    //         config: oauthConfig.config,
    //         scopes: oauthConfig.scopes,
    //         autoRegistrationId: autoReg.id
    //       }
    //     });

    //     await db.serverDeployment.update({
    //       where: { id: serverDeployment.id },
    //       data: {
    //         oauthConnectionOid: connection.oid,
    //         isOauthConnectionPending: false
    //       }
    //     });
    //   } catch (e) {
    //     Sentry.captureException(e);

    //     let error = {
    //       code: 'auto_registration_failed',
    //       message: 'Failed to set up OAuth connection'
    //     };
    //     let mustFail = false;

    //     if (e instanceof OAuthSetupError) {
    //       mustFail = true;
    //       error.code = e.code;
    //       error.message = e.message;
    //     }

    //     if (tryNumber >= MAX_TRIES || mustFail) {
    //       await db.serverDeployment.update({
    //         where: { id: serverDeployment.id },
    //         data: {
    //           status: 'failed',
    //           failureCode: error.code,
    //           failureMessage: error.message,
    //           isOauthConnectionPending: false
    //         }
    //       });
    //     } else {
    //       await serverDeploymentSetupQueue.add(
    //         {
    //           serverDeploymentId: serverDeployment.id,
    //           tryNumber: tryNumber + 1
    //         },
    //         { delay: 1000 * 60 * tryNumber }
    //       );
    //     }
    //   }
    // }
  }
);
