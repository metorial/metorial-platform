import { delay } from '@lowerdeck/delay';
import { createQueue } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { env } from '../../env';
import { DeploymentManager } from '../../lib/deployment';
import { callFunction } from '../../lib/function/call';
import { normalizeJsonSchema } from '../../lib/jsonSchema/normalizeJsonSchema';
import { functionServerInvocationService } from '../../services';
import { deployServerFailedQueue } from '../deployment/failed';
import { deployFunctionServerPublishQueue } from './publish';

let Sentry = getSentry();
let DISCOVERY_TIMEOUT_MS = Math.max(
  30_000,
  (env.functionBay.FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS + 10) * 1000
);

class FunctionDiscoveryTimeoutError extends Error {
  constructor() {
    super(`Discovery timed out after ${Math.round(DISCOVERY_TIMEOUT_MS / 1000)} seconds`);
    this.name = 'FunctionDiscoveryTimeoutError';
  }
}

export let deployFunctionServerDiscoverQueue = createQueue<{
  serverDeploymentId: string;
  functionServerId: string;
}>({
  name: 'shut/func-ser/deploy/discover',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 50
  }
});

export let deployFunctionServerDiscoverQueueProcessor =
  deployFunctionServerDiscoverQueue.process(async data => {
    let functionServer = await db.functionServer.findFirst({
      where: { id: data.functionServerId }
    });
    if (!functionServer) return;

    let dep = await DeploymentManager.of(data);
    let step = await dep.step('discovering');

    let failDiscovery = async (d: {
      errorCode: string;
      errorMessage: string;
      logMessage?: string | string[];
    }) => {
      await db.functionServer.update({
        where: { id: functionServer.id },
        data: {
          status: 'failed',
          errorCode: d.errorCode,
          errorMessage: d.errorMessage
        }
      });

      step.log(d.logMessage ?? `Discovery failed: ${d.errorMessage}`);
      await step.fail();

      await deployServerFailedQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    };

    step.log('Starting discovery');

    let discoveryStartTime = Date.now();
    let longerThanExpectedLogged = false;
    let pingIV = setInterval(() => {
      if (!longerThanExpectedLogged && Date.now() - discoveryStartTime > 20_000) {
        step.log(`Discovery is taking longer than expected.`);
        longerThanExpectedLogged = true;
      }

      step.log(
        `Discovering MCP server... (${Math.round((Date.now() - discoveryStartTime) / 1000)}s)`
      );
    }, 10_000);

    try {
      let discoveryRes = await Promise.race([
        callFunction(functionServer, {}, client => client.discover()),
        delay(DISCOVERY_TIMEOUT_MS).then(() => {
          throw new FunctionDiscoveryTimeoutError();
        })
      ]);

      let functionLogs = discoveryRes.logs
        .map(l => l.message)
        .filter(message => message.trim());

      if (discoveryRes.status == 'error') {
        if (discoveryRes.functionCallId && dep.serverDeployment.tenantOid) {
          let tenant = await db.tenant.findUnique({
            where: { oid: dep.serverDeployment.tenantOid }
          });

          if (tenant) {
            await functionServerInvocationService.ensureFunctionServerInvocation({
              functionServer,
              tenant,
              functionInvocationId: discoveryRes.functionCallId,
              isError: true,
              error: discoveryRes.error,
              logs: discoveryRes.logs
            });
          }
        }

        await failDiscovery({
          errorCode: discoveryRes.error.code,
          errorMessage: discoveryRes.error.message,
          logMessage: [
            ...(functionLogs.length ? ['Function logs:', ...functionLogs] : []),
            `Discovery failed: ${discoveryRes.error.code} - ${discoveryRes.error.message}`
          ]
        });
        return;
      } else {
        step.log(functionLogs);

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
      if (!(e instanceof FunctionDiscoveryTimeoutError)) {
        Sentry.captureException(e);
      }

      let errorMessage =
        e instanceof Error ? e.message : 'Unknown MCP server discovery failure';

      await failDiscovery({
        errorCode:
          e instanceof FunctionDiscoveryTimeoutError
            ? 'discovery_timeout'
            : 'discovery_failed',
        errorMessage,
        logMessage:
          e instanceof FunctionDiscoveryTimeoutError
            ? errorMessage
            : `MCP server discovery failed: ${errorMessage}`
      });
    } finally {
      clearInterval(pingIV);
    }
  });
