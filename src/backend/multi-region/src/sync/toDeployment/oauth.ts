import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { OAuthApplication, OAuthApplicationClientSecret } from '../../db';

export let syncOAuthAppToDeploymentQueue = createQueue<{
  app: OAuthApplication & {
    clientSecrets: OAuthApplicationClientSecret[];
  };
}>({
  name: 'global/sync/to-deployment/oauth-app'
});

export let syncOAuthAppToDeploymentQueueProcessor = syncOAuthAppToDeploymentQueue.process(
  async data => {
    let app = data.app;
    // if (app.ownerOid === (await cell).oid) return;

    if (app.accessLevel === 'organization') return;
    if (app.type === 'server_side') return;

    let inner = {
      id: app.id,

      status: app.status,
      type: app.type,
      accessLevel: app.accessLevel,
      allowClientSecretlessTokenExchange: app.allowClientSecretlessTokenExchange,

      name: app.name,
      description: app.description,
      image: app.image,

      websiteUrl: app.websiteUrl,
      privacyPolicyUrl: app.privacyPolicyUrl,
      termsOfServiceUrl: app.termsOfServiceUrl,
      redirectUris: app.redirectUris,

      scopes: app.scopes,

      clientId: app.clientId
    };

    await db.oAuthApplication.upsert({
      where: { id: app.id },
      update: {
        ...inner,

        clientSecrets: {
          upsert: app.clientSecrets.map(secret => ({
            where: { id: secret.id },
            update: {
              secret: secret.secret,
              createdAt: secret.createdAt,
              deletedAt: secret.deletedAt
            },
            create: {
              id: secret.id,
              secret: secret.secret,
              secretPreview: '••••••••',
              createdAt: secret.createdAt,
              deletedAt: secret.deletedAt
            }
          }))
        }
      },
      create: {
        ...inner,

        isImportedFromOtherInstance: true,

        clientSecrets: {
          create: app.clientSecrets.map(secret => ({
            id: secret.id,
            secret: secret.secret,
            secretPreview: '••••••••',
            createdAt: secret.createdAt,
            deletedAt: secret.deletedAt
          }))
        }
      }
    });
  }
);
