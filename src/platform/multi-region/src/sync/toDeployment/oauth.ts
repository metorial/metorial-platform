import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB, OAuthApplication, OAuthApplicationClientSecret } from '../../db';

let RECONCILE_PAGE_SIZE = 500;

export let syncOAuthAppToDeploymentQueue = createQueue<{
  app: OAuthApplication & {
    clientSecrets: OAuthApplicationClientSecret[];
  };
}>({
  name: 'global/sync/to-deployment/oauth-app',
  workerOpts: { concurrency: 50 }
});

let upsertOAuthAppFromGlobal = async (
  app: OAuthApplication & { clientSecrets: OAuthApplicationClientSecret[] }
) => {
  if (app.accessLevel === 'organization') return;
  if (app.type === 'server_side') return;

  let inner = {
    id: app.id,

    status: app.status,
    type: app.type,
    accessLevel: app.accessLevel,
    subjectType: app.subjectType,
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
};

export let syncOAuthAppToDeploymentQueueProcessor = syncOAuthAppToDeploymentQueue.process(
  async data => {
    await upsertOAuthAppFromGlobal(data.app);
  }
);

// The incremental sync only looks at a time window and never retries, so an app that
// was missed once (failed job, clock skew) would never arrive. This pass is idempotent.
export let reconcileOAuthAppsCron = createCron(
  {
    name: 'global/sync/to-deployment/oauth-app-reconcile',
    cron: process.env.NODE_ENV == 'production' ? '*/10 * * * *' : '* * * * *'
  },
  async () => {
    await reconcileOAuthAppsManyQueue.add({});
  }
);

let reconcileOAuthAppsManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/to-deployment/oauth-app-reconcile-many',
  workerOpts: { concurrency: 1 }
});

export let reconcileOAuthAppsManyQueueProcessor = reconcileOAuthAppsManyQueue.process(
  async data => {
    let apps = await globalDB.oAuthApplication.findMany({
      where: {
        id: { gt: data.cursor },
        ownerOid: { not: (await cell).oid },
        accessLevel: 'global',
        type: { not: 'server_side' }
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_PAGE_SIZE,
      select: { id: true }
    });
    if (apps.length === 0) return;

    await reconcileOAuthAppSingleQueue.addMany(apps.map(app => ({ appId: app.id })));

    if (apps.length === RECONCILE_PAGE_SIZE) {
      await reconcileOAuthAppsManyQueue.add(
        { cursor: apps[apps.length - 1].id },
        hourlyPacedDelay()
      );
    }
  }
);

let reconcileOAuthAppSingleQueue = createQueue<{ appId: string }>({
  name: 'global/sync/to-deployment/oauth-app-reconcile-single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let reconcileOAuthAppSingleQueueProcessor = reconcileOAuthAppSingleQueue.process(
  async data => {
    let app = await globalDB.oAuthApplication.findUnique({
      where: { id: data.appId },
      include: { clientSecrets: true }
    });
    if (!app) return;

    await upsertOAuthAppFromGlobal(app);
  }
);
