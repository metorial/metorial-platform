import { canonicalize } from '@mtsrc/canonicalize';
import { Hash } from '@mtsrc/hash';
import { createQueue } from '@mtsrc/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { DeploymentManager } from '../../lib/deployment';
import { versionIdentifier } from '../../lib/identifier/version';
import { normalizeJsonSchema } from '../../lib/jsonSchema/normalizeJsonSchema';
import { withTransaction } from '../../transaction';
import { deployServerSucceededQueue } from '../deployment/succeeded';
import { serverVersionCreatedQueue } from '../lifecycle/serverVersion';

export let deployFunctionServerPublishQueue = createQueue<{
  serverDeploymentId: string;
  functionServerId: string;
}>({
  name: 'shut/func-ser/deploy/publish',
  redisUrl: env.service.REDIS_URL
});

export let deployFunctionServerPublishQueueProcessor =
  deployFunctionServerPublishQueue.process(async data => {
    let functionServer = await db.functionServer.findFirst({
      where: { id: data.functionServerId }
    });
    if (!functionServer) return;

    let dep = await DeploymentManager.of(data);
    let serverDeployment = dep.serverDeployment;

    await withTransaction(async db => {
      let server = await db.server.update({
        where: { oid: functionServer.serverOid },
        data: {
          draftConfigSchema: functionServer.configSchema,
          draftConfigTransformer: '$.config'
        }
      });

      if (functionServer.supportsOAuth) {
        let authConfig = normalizeJsonSchema({ schema: functionServer.authConfigSchema });
        let hash = await Hash.sha256(canonicalize(authConfig));

        let delegatedOAuthConfig = await db.delegatedOAuthConfig.upsert({
          where: {
            serverOid_authConfigSchemaHash: {
              serverOid: server.oid,
              authConfigSchemaHash: hash
            }
          },
          update: {
            functionServerOid: functionServer.oid,
            supportsOauthTokenRefresh: functionServer.supportsOauthTokenRefresh
          },
          create: {
            ...getId('delegatedOAuthConfig'),
            name: server.name,
            authConfigSchema: functionServer.authConfigSchema,
            authConfigSchemaHash: hash,
            supportsOauthTokenRefresh: functionServer.supportsOauthTokenRefresh,
            serverOid: server.oid,
            functionServerOid: functionServer.oid
          }
        });

        await db.functionServer.updateMany({
          where: { oid: functionServer.oid },
          data: { delegatedOauthConfigOid: delegatedOAuthConfig.oid }
        });

        await db.server.updateMany({
          where: { oid: server.oid },
          data: { delegatedOauthConfigOid: delegatedOAuthConfig.oid }
        });
      }

      let version = await db.serverVersion.create({
        data: {
          ...getId('serverVersion'),
          identifier: versionIdentifier.function({ server }),

          configSchema: functionServer.configSchema,
          configTransformer: '$.config',

          serverOid: server.oid,
          tenantOid: server.tenantOid,
          deploymentOid: serverDeployment.oid,
          functionServerOid: functionServer.oid
        }
      });
      await serverVersionCreatedQueue.add({
        serverVersionId: version.id
      });

      await deployServerSucceededQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    });
  });
