import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { db } from '../../db';
import { env } from '../../env';
import {
  fallbackFunctionBayTenant,
  functionBay,
  functionBayProvider,
  getTenantForFunctionBay
} from '../../functionBay';
import { getId } from '../../id';
import { DeploymentManager } from '../../lib/deployment';
import { getFunctionFs } from '../../lib/function/getFs';
import { deployServerFailedQueue } from '../deployment/failed';
import { deployFunctionServerWatchQueue } from './monitor';

export let deployFunctionServerStartQueue = createQueue<{
  upcomingFunctionServerId: string;
  serverDeploymentId: string;
}>({
  name: 'shut/func-ser/deploy/start',
  redisUrl: env.service.REDIS_URL
});

export let deployFunctionServerStartQueueProcessor = deployFunctionServerStartQueue.process(
  async data => {
    let upcomingFunctionServer = await db.upcomingFunctionServer.findFirst({
      where: { id: data.upcomingFunctionServerId },
      include: { tenant: true, server: true }
    });
    if (!upcomingFunctionServer) throw new QueueRetryError();

    let dep = await DeploymentManager.of({ serverDeploymentId: data.serverDeploymentId });
    let step = await dep.step('started');

    await db.serverDeployment.update({
      where: { id: data.serverDeploymentId },
      data: {
        status: 'deploying',
        startedAt: step.step.startedAt
      }
    });

    step.log('Starting MCP server deployment with Metorial Shuttle');

    try {
      let filesRes = getFunctionFs(upcomingFunctionServer);
      step.log(filesRes.logs);
      if (!filesRes.ok) throw new Error('Failed to get function filesystem');

      let functionServerId = getId('functionServer');
      let functionBayTenant = upcomingFunctionServer.tenant
        ? await getTenantForFunctionBay(upcomingFunctionServer.tenant)
        : await fallbackFunctionBayTenant;
      let newFunction = await functionBay.function.upsert({
        tenantId: functionBayTenant.id,
        name: `Server Function - ${upcomingFunctionServer.server.name}`,
        identifier: functionServerId.id
      });

      let functionBayDeployment = await functionBay.functionDeployment.create({
        tenantId: functionBayTenant.id,
        name: `Server Function - ${upcomingFunctionServer.server.name}`,
        functionId: newFunction.id,

        files: filesRes.files ?? [],
        env: upcomingFunctionServer.payload.env,
        runtime: upcomingFunctionServer.payload.runtime,

        config: {
          memorySizeMb: env.functionBay.FUNCTION_BAY_DEFAULT_MEMORY_MB,
          timeoutSeconds: env.functionBay.FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS
        }
      });

      let functionServer = await db.functionServer.create({
        data: {
          ...functionServerId,
          status: 'pending',

          supportsOAuth: false,
          supportsOauthTokenRefresh: false,
          configSchema: null,
          authConfigSchema: null,

          info: {
            info: { name: '...', version: '...' },
            capabilities: {}
          },

          functionBayFunctionId: newFunction.id,
          functionBayTenantId: functionBayTenant.id,
          functionBayDeploymentId: functionBayDeployment.id,
          functionBayVersionId: functionBayDeployment.version?.id,

          providerOid: functionBayProvider.oid,
          serverOid: upcomingFunctionServer.server.oid
        }
      });

      await db.serverDeployment.updateMany({
        where: { id: data.serverDeploymentId },
        data: {
          functionServerOid: functionServer.oid
        }
      });

      await db.upcomingFunctionServer.deleteMany({
        where: { oid: upcomingFunctionServer.oid }
      });

      await step.succeed();

      let deployingStep = await dep.step('deploying');

      await deployFunctionServerWatchQueue.add({
        serverDeploymentId: data.serverDeploymentId,
        functionServerId: functionServer.id,
        functionBayTenantId: functionBayTenant.id,
        functionBayFunctionId: newFunction.id,
        functionBayDeploymentId: functionBayDeployment.id,
        deployingStepId: deployingStep.step.id
      });
    } catch (e) {
      step.log(`MCP server deployment failed`);
      await step.fail();

      await deployServerFailedQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    }
  }
);
