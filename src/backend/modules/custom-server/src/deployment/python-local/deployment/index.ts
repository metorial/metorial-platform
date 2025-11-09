import {
  CodeBucket,
  CustomServer,
  CustomServerDeployment,
  db,
  Instance,
  LambdaServerInstance
} from '@metorial/db';
import { delay } from '@metorial/delay';
import { joinPaths } from '@metorial/join-paths';
import axios from 'axios';
import { env } from '../../../env';
import { DeploymentError } from '../../base/error';
import { getPythonFs } from '../fs';

axios.defaults.headers.common['Accept-Encoding'] = 'gzip';

// Determine deployment mode
export let isPythonLocalEnabled = () => env.python.PYTHON_RUNNER_ADDRESS;

export let createPythonLambdaDeployment = async (config: {
  lambdaServerInstance: LambdaServerInstance & {
    immutableCodeBucket: CodeBucket;
    instance: Instance;
  };
  customServer: CustomServer;
  deployment: CustomServerDeployment;
}) => {
  if (!isPythonLocalEnabled()) {
    throw new Error('Python Local deployment is not enabled in the environment variables.');
  }

  let lambdaServerInstance = config.lambdaServerInstance;

  let deployment = await Promise.race([
    delay(1000 * 60 * 2).then(() => {
      throw new DeploymentError({
        code: 'deployment_timeout',
        message: 'Python deployment timed out after 5 minutes'
      });
    }),
    (async () => {
      let fs = await getPythonFs(lambdaServerInstance);

      let deploymentPayload = {
        entryPointUrl: fs.entrypoint,
        envVars: {
          ...fs.env,
          METORIAL_AUTH_TOKEN_SECRET: lambdaServerInstance.securityToken
        },
        description: `CSRV ${config.customServer.id} / DEPL ${config.deployment.id}`,
        permissions: {
          net: ['*']
        },
        assets: Object.fromEntries(
          Array.from(fs.files.entries()).map(([k, v]) => [
            k,
            {
              kind: 'file',
              encoding: 'utf-8',
              content: v
            }
          ])
        )
      };

      let deploymentId: string;
      let providerResourceAccessIdentifier: string;

      let runnerDeployment = await axios.post<{ id: string }>(
        `${env.python.PYTHON_RUNNER_ADDRESS}/deployments`,
        deploymentPayload
      );

      deploymentId = runnerDeployment.data.id;
      providerResourceAccessIdentifier = `${env.python.PYTHON_RUNNER_ADDRESS}/${deploymentId}`;

      return await db.lambdaServerInstance.update({
        where: { oid: lambdaServerInstance.oid },
        data: {
          status: 'deploying',
          providerInfo: { id: deploymentId },
          providerResourceId: deploymentId,
          providerResourceAccessIdentifier,
          runtime: 'python_self_hosted_v1',
          provider: 'python_self_hosted',
          platform: 'metorial_stellar_v1',
          protocol: 'metorial_stellar_over_websocket_v1'
        }
      });
    })()
  ]);

  let serverUrl = { current: deployment.providerResourceAccessIdentifier || '' };

  return {
    pollDeploymentStatus: async () => {
      return {
        status: 'success' as const,
        logs: [] as { type: 'info' | 'error'; lines: string[] }[]
      };
    },

    discoverServer: async () => {
      let discoverUrl = new URL(serverUrl.current);
      discoverUrl.pathname = joinPaths(discoverUrl.pathname, '/discover');
      let discoverRes = await axios.get<any>(discoverUrl.toString(), {
        headers: {
          'metorial-stellar-token': lambdaServerInstance.securityToken
        },
        timeout: 5000
      });

      let oauthUrl = new URL(serverUrl.current);
      oauthUrl.pathname = joinPaths(oauthUrl.pathname, '/oauth');
      let oauthRes = await axios.get<{ enabled: boolean; hasForm: boolean }>(
        oauthUrl.toString(),
        {
          headers: {
            'metorial-stellar-token': lambdaServerInstance.securityToken
          },
          timeout: 5000
        }
      );

      let callbacksUrl = new URL(serverUrl.current);
      callbacksUrl.pathname = joinPaths(callbacksUrl.pathname, '/callbacks');
      let callbacksRes = await axios.get<{
        enabled: boolean;
        type: 'webhook' | 'polling' | 'manual';
      }>(callbacksUrl.toString(), {
        headers: {
          'metorial-stellar-token': lambdaServerInstance.securityToken
        },
        timeout: 5000
      });

      return {
        capabilities: discoverRes.data,
        oauth: oauthRes.data,
        callbacks: callbacksRes.data
      };
    },

    get httpEndpoint() {
      return serverUrl.current;
    }
  };
};

export type PythonDeployment = Awaited<ReturnType<typeof createPythonLambdaDeployment>>;
