import { createCron } from '@metorial/cron';
import { addAfterTransactionHook, db, OAuthToken } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';
import { upsertOrganization } from './organization';

let syncOAuthApp = async (_app: { id: string }) => {
  let app = await db.oAuthApplication.findUnique({
    where: { id: _app.id },
    include: { clientSecrets: true, organization: true }
  });
  if (!app) return;

  // Only sync apps what we own
  if (app.isImportedFromOtherInstance) return;

  // // Only sync apps that can be used in other deployments
  // if (app.type == 'server_side') return;
  // if (app.accessLevel == 'organization') return;

  if (app.organization) await upsertOrganization(app.organization.id);

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

    organizationId: app.organization?.id,

    scopes: app.scopes,

    clientId: app.clientId,

    ownerOid: (await cell).oid
  };

  await globalDB.oAuthApplication.upsert({
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
            createdAt: secret.createdAt,
            deletedAt: secret.deletedAt
          }
        }))
      }
    },
    create: {
      ...inner,

      clientSecrets: {
        create: app.clientSecrets.map(secret => ({
          id: secret.id,
          secret: secret.secret,
          createdAt: secret.createdAt,
          deletedAt: secret.deletedAt
        }))
      }
    }
  });
};

Fabric.listen('machine_access.oauth_application.updated:after', async event => {
  await syncOAuthApp(event.oauthApplication);
});

Fabric.listen('machine_access.oauth_application.created:after', async event => {
  await syncOAuthApp(event.oauthApplication);
});

Fabric.listen('machine_access.oauth_application.archived:after', async event => {
  await syncOAuthApp(event.oauthApplication);
});

Fabric.listen('machine_access.oauth_application.client_secret.create:after', async event => {
  await syncOAuthApp(event.oauthApplication);
});

Fabric.listen('machine_access.oauth_application.client_secret.revoked:after', async event => {
  await syncOAuthApp(event.oauthApplication);
});

let syncOAuthTokenToGlobal = async (d: {
  oauthToken: OAuthToken;
  oauthApplicationId: string;
}) => {
  await globalDB.oAuthToken.upsert({
    where: {
      id: d.oauthToken.id
    },
    update: {
      accessToken: d.oauthToken.accessToken,
      refreshToken: d.oauthToken.refreshToken,
      oauthApplicationId: d.oauthApplicationId,
      ownerOid: (await cell).oid,
      createdAt: d.oauthToken.createdAt
    },
    create: {
      id: d.oauthToken.id,
      accessToken: d.oauthToken.accessToken,
      refreshToken: d.oauthToken.refreshToken,
      oauthApplicationId: d.oauthApplicationId,
      ownerOid: (await cell).oid,
      createdAt: d.oauthToken.createdAt
    }
  });
};

Fabric.listen('machine_access.oauth_token.created:after', async event => {
  addAfterTransactionHook(() =>
    syncOAuthTokenToGlobal({
      oauthToken: event.oauthToken,
      oauthApplicationId: event.oauthApplication.id
    })
  );
});

Fabric.listen('machine_access.oauth_token.refreshed:after', async event => {
  addAfterTransactionHook(() =>
    syncOAuthTokenToGlobal({
      oauthToken: event.oauthToken,
      oauthApplicationId: event.oauthApplication.id
    })
  );
});

export let syncAppsCron = createCron(
  {
    name: 'global/sync/from-deployment/oauth-app',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncAppsManyQueue.add({});
  }
);

let syncAppsManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/oauth-app-many'
});

export let syncAppsManyQueueProcessor = syncAppsManyQueue.process(async data => {
  let apps = await db.oAuthApplication.findMany({
    where: {
      id: { gt: data.cursor }
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (apps.length === 0) return;

  await syncOAuthAppSingleQueue.addMany(apps.map(app => ({ appId: app.id })));

  await syncAppsManyQueue.add({ cursor: apps[apps.length - 1].id });
});

let syncOAuthAppSingleQueue = createQueue<{ appId: string }>({
  name: 'global/sync/from-deployment/oauth-app-single'
});

export let syncOAuthAppSingleQueueProcessor = syncOAuthAppSingleQueue.process(async data => {
  await syncOAuthApp({ id: data.appId });
});
