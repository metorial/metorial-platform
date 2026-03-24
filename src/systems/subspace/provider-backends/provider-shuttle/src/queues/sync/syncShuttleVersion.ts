import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { snowflake, withTransaction } from '@metorial-subspace/db';
import { syncVersionToCustomProvider } from '@metorial-subspace/module-custom-provider';
import { shuttle, shuttleDefaultReaderTenant } from '../../client';
import { env } from '../../env';
import { upsertShuttleServerVersion } from '../../lib/upsertShuttleVersion';

export let syncShuttleVersionQueue = createQueue<{
  serverId: string;
  serverVersionId: string;
  tenantId: string | undefined;
}>({
  name: 'sub/shut/sync',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
});

let shuttleServerVersionUpsertLock = createLock({
  name: 'sub/shut/serverVersion/upsert/lock',
  redisUrl: env.service.REDIS_URL
});

export let syncShuttleVersionQueueProcessor = syncShuttleVersionQueue.process(async data => {
  let version = await shuttle.serverVersion.get({
    serverVersionId: data.serverVersionId,
    tenantId: data.tenantId ?? shuttleDefaultReaderTenant.id
  });

  let server = await shuttle.server.get({
    serverId: version.serverId,
    tenantId: version.tenantId ?? shuttleDefaultReaderTenant.id
  });

  let deployment = await shuttle.serverDeployment.get({
    tenantId: data.tenantId ?? shuttleDefaultReaderTenant.id,
    serverDeploymentId: version.deploymentId
  });

  try {
    await withTransaction(async db => {
      let shuttleServerRecord = await db.shuttleServer.upsert({
        where: { id: server.id },
        create: {
          oid: snowflake.nextId(),
          id: server.id,
          identifier: server.id,
          shuttleTenantId: server.tenantId!,
          type: server.type
        },
        update: {}
      });

      let newShuttleServerVersionRecord = snowflake.nextId();
      let shuttleServerVersionRecord = await db.shuttleServerVersion.upsert({
        where: { id: version.id },
        create: {
          oid: newShuttleServerVersionRecord,
          id: version.id,
          version: version.id,
          identifier: `${server.id}::${version.id}`,
          serverOid: shuttleServerRecord.oid
        },
        update: {}
      });

      // Avoid race conditions with custom servers,
      // i.e., servers owned by another tenant
      let timeSinceCreation = Date.now() - version.createdAt.getTime();
      if (timeSinceCreation < 1000 * 120 && server.tenantId) {
        await syncShuttleVersionQueue.add(data, { delay: 1000 * 120 });
        return;
      }

      // Abort if the version already existed -> was created using a custom server
      if (shuttleServerVersionRecord.oid !== newShuttleServerVersionRecord) {
        return;
      }

      let tenant = server.tenantId
        ? await db.tenant.findFirst({
            where: { shuttleTenantId: server.tenantId }
          })
        : null;

      // We don't know who owns this server, but it's certainly not us
      if (server.tenantId && !tenant) return;

      if (!tenant) {
        await upsertShuttleServerVersion({
          publisherId: (server.metadata as any)?.publisherId,
          globalIdentifier: (server.metadata as any)?.globalIdentifier,

          shuttleServer: server,
          shuttleServerVersion: version,

          shuttleServerRecord,
          shuttleServerVersionRecord,

          info: {
            categories: (server.metadata as any)?.categories ?? []
          }
        });
      } else {
        let variant = await db.providerVariant.findFirst({
          where: {
            shuttleServerOid: shuttleServerRecord.oid
          },
          include: {
            provider: {
              include: {
                customProvider: true
              }
            }
          }
        });
        let customProvider = variant?.provider?.customProvider;
        if (!customProvider) {
          throw new Error('No custom provider found for tenant-specific shuttle server');
        }
        if (tenant.oid !== customProvider.tenantOid) {
          throw new Error('Tenant mismatch for custom provider shuttle server');
        }
        if (!customProvider.shuttleCustomServerOid) {
          throw new Error('Custom provider has no associated custom shuttle server');
        }

        let shuttleCustomServerRecord = await db.shuttleCustomServer.upsert({
          where: { id: server.id },
          create: {
            oid: snowflake.nextId(),
            id: server.id,
            identifier: deployment.id,
            serverOid: shuttleServerRecord.oid,
            tenantOid: tenant.oid,
            shuttleTenantId: server.tenantId!
          },
          update: {}
        });

        let shuttleCustomDeploymentRecord = await db.shuttleCustomServerDeployment.upsert({
          where: { id: deployment.id },
          create: {
            oid: snowflake.nextId(),
            id: deployment.id,
            identifier: deployment.id,
            serverVersionOid: shuttleServerVersionRecord.oid,
            serverOid: shuttleServerRecord.oid,
            tenantOid: tenant.oid,
            customServerOid: shuttleCustomServerRecord.oid
          },
          update: {}
        });

        await withTransaction(async db => {
          let versionRes = await upsertShuttleServerVersion({
            shuttleServer: server,
            shuttleServerVersion: version,

            shuttleServerRecord,
            shuttleServerVersionRecord
          });

          await syncVersionToCustomProvider({
            providerVersion: versionRes.providerVersion,

            message:
              version.repositoryTag && version.repositoryVersion
                ? `Digest of ${version.repositoryTag.name} was updated to ${version.repositoryVersion}`
                : 'System built new version',

            shuttleServer: shuttleServerRecord,
            shuttleCustomServer: shuttleCustomServerRecord,
            shuttleCustomDeployment: shuttleCustomDeploymentRecord
          });
        });
      }
    });
  } catch (err: any) {
    if (err.message.includes('Unique constraint failed on the fields: (`id`)')) {
      return;
    }

    throw err;
  }
});
