import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { DeploymentManager } from '../../lib/deployment';
import { callFunction } from '../../lib/function/call';
import { normalizeJsonSchema } from '../../lib/jsonSchema/normalizeJsonSchema';
import { deployServerFailedQueue } from '../deployment/failed';
import { deployFunctionServerPublishQueue } from './publish';

export let deployFunctionServerDiscoverQueue = createQueue<{
  serverDeploymentId: string;
  functionServerId: string;
}>({
  name: 'shut/func-ser/deploy/discover',
  redisUrl: env.service.REDIS_URL
});

export let deployFunctionServerDiscoverQueueProcessor =
  deployFunctionServerDiscoverQueue.process(async data => {
    let functionServer = await db.functionServer.findFirst({
      where: { id: data.functionServerId }
    });
    if (!functionServer) return;

    let dep = await DeploymentManager.of(data);
    let step = await dep.step('discovering');

    try {
      let discoveryRes = await callFunction(functionServer, client => client.discover());

      step.log(discoveryRes.logs.map(l => l.message));

      if (discoveryRes.status == 'error') {
        await db.functionServer.update({
          where: { id: functionServer.id },
          data: {
            status: 'failed',
            errorCode: discoveryRes.error.code,
            errorMessage: discoveryRes.error.message
          }
        });

        deployServerFailedQueue.add({
          serverDeploymentId: data.serverDeploymentId
        });

        step.log(`Discovery failed: ${discoveryRes.error.message}`);
        await step.fail();
        return;
      } else {
        await db.functionServer.update({
          where: { id: functionServer.id },
          data: {
            status: 'succeeded',

            info: {
              info: discoveryRes.result.server.info!,
              capabilities: discoveryRes.result.server.capabilities!,
              instructions: discoveryRes.result.server.instructions
            },

            configSchema: normalizeJsonSchema({ schema: discoveryRes.result.configSchema }),
            authConfigSchema:
              discoveryRes.result.oauth.status == 'enabled'
                ? normalizeJsonSchema({
                    schema: discoveryRes.result.oauth.authConfig
                  })
                : null,

            supportsOAuth: discoveryRes.result.oauth.status == 'enabled',
            supportsOauthTokenRefresh:
              discoveryRes.result.oauth.status == 'enabled' &&
              discoveryRes.result.oauth.hasTokenRefresh
          }
        });

        step.log('Discovery succeeded');
        await step.succeed();

        await deployFunctionServerPublishQueue.add({
          serverDeploymentId: data.serverDeploymentId,
          functionServerId: data.functionServerId
        });
      }
    } catch (e) {
      step.log(`MCP server discovery failed`);
      await step.fail();

      await deployServerFailedQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    }
  });
