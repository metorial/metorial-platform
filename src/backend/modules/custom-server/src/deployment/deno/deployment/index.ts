import {
  CodeBucket,
  CustomServer,
  CustomServerDeployment,
  db,
  Instance,
  LambdaServerInstance
} from '@metorial/db';
import { generatePlainId } from '@metorial/id';
import { joinPaths } from '@metorial/join-paths';
import { createLock } from '@metorial/lock';
import axios from 'axios';
import { env } from '../../../env';
import { getDenoFs } from '../fs';

axios.defaults.headers.common['Accept-Encoding'] = 'gzip';

let deploymentLock = createLock({
  name: 'csrv/deno/dep'
});

// Determine deployment mode
const USE_DENO_DEPLOY = !!(env.deno.DENO_DEPLOY_TOKEN && env.deno.DENO_ORGANIZATION_ID);
const USE_SELF_HOSTED = !USE_DENO_DEPLOY && !!env.deno.DENO_RUNNER_ADDRESS;

export let createDenoLambdaDeployment = async (config: {
  lambdaServerInstance: LambdaServerInstance & {
    immutableCodeBucket: CodeBucket;
    instance: Instance;
  };
  customServer: CustomServer;
  deployment: CustomServerDeployment;
}) => {
  if (!USE_DENO_DEPLOY && !USE_SELF_HOSTED) {
    throw new Error(
      'Deno deployment not configured: Either set DENO_DEPLOY_TOKEN + DENO_ORGANIZATION_ID for Deno Deploy, or DENO_RUNNER_ADDRESS for self-hosted runner'
    );
  }

  let lambdaServerInstance = config.lambdaServerInstance;

  let deployment = await deploymentLock.usingLock(config.customServer.id, async () => {
    let fs = await getDenoFs(lambdaServerInstance);

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

    if (!USE_DENO_DEPLOY) {
      // Self-hosted runner deployment
      let runnerDeployment = await axios.post<{ id: string }>(
        `${env.deno.DENO_RUNNER_ADDRESS}/deployments`,
        deploymentPayload
      );

      deploymentId = runnerDeployment.data.id;
      providerResourceAccessIdentifier = `${env.deno.DENO_RUNNER_ADDRESS}/${deploymentId}`;

      return await db.lambdaServerInstance.update({
        where: { oid: lambdaServerInstance.oid },
        data: {
          status: 'deploying',
          providerInfo: { id: deploymentId },
          providerResourceId: deploymentId,
          providerResourceAccessIdentifier,
          runtime: 'deno_self_hosted_v1',
          provider: 'deno_self_hosted',
          platform: 'metorial_stellar_v1',
          protocol: 'metorial_stellar_over_websocket_v1'
        }
      });
    } else {
      // Deno Deploy
      let project = await db.lambdaServerDenoDeployProject.findFirst({
        where: {
          customServerOid: config.customServer.oid
        }
      });

      if (!project) {
        let denoProject = await axios.post<{
          id: string;
        }>(
          `https://api.deno.com/v1/organizations/${env.deno.DENO_ORGANIZATION_ID}/projects`,
          {
            name: `mt-crv-${generatePlainId(15)}`.toLowerCase()
          },
          {
            headers: {
              Authorization: `Bearer ${env.deno.DENO_DEPLOY_TOKEN}`
            }
          }
        );

        project = await db.lambdaServerDenoDeployProject.create({
          data: {
            customServerOid: config.customServer.oid,
            denoDeployProjectId: denoProject.data.id
          }
        });
      }

      let denoDeployment = await axios.post<{
        id: string;
      }>(
        `https://api.deno.com/v1/projects/${project.denoDeployProjectId}/deployments`,
        {
          ...deploymentPayload,
          domains: ['{project.name}-{deployment.id}.deno.dev']
        },
        {
          headers: {
            Authorization: `Bearer ${env.deno.DENO_DEPLOY_TOKEN}`
          }
        }
      );

      deploymentId = denoDeployment.data.id;

      return await db.lambdaServerInstance.update({
        where: { oid: lambdaServerInstance.oid },
        data: {
          status: 'deploying',
          providerInfo: denoDeployment.data,
          providerResourceId: deploymentId,
          // providerResourceAccessIdentifier will be set in pollDeploymentStatus
          runtime: 'deno_deploy_v1',
          provider: 'deno_deploy',
          platform: 'metorial_stellar_v1',
          protocol: 'metorial_stellar_over_websocket_v1'
        }
      });
    }
  });

  let offsetRef = { current: 0 };
  let serverUrl = { current: deployment.providerResourceAccessIdentifier || '' };

  return {
    pollDeploymentStatus: async () => {
      if (USE_SELF_HOSTED) {
        // Self-hosted runner - already running, no polling needed
        return {
          status: 'success' as const,
          logs: []
        };
      }

      // Deno Deploy - poll for status
      let status = await axios.get<{
        status: 'failed' | 'pending' | 'success';
        domains: string[];
      }>(`https://api.deno.com/v1/deployments/${deployment.providerResourceId}`, {
        headers: {
          Authorization: `Bearer ${env.deno.DENO_DEPLOY_TOKEN}`
        }
      });

      if (status.data?.domains?.length) {
        serverUrl.current = `https://${status.data.domains[0]}`;
        await db.lambdaServerInstance.update({
          where: { oid: deployment.oid },
          data: {
            providerResourceAccessIdentifier: serverUrl.current
          }
        });
      }

      let buildLogs = await axios.get<{ level: 'error' | 'info'; message: string }[]>(
        `https://api.deno.com/v1/deployments/${deployment.providerResourceId}/build_logs`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${env.deno.DENO_DEPLOY_TOKEN}`
          }
        }
      );

      buildLogs.data = buildLogs.data.filter(l => !l.message.includes('.deno.dev'));

      let newLogs = buildLogs.data.slice(offsetRef.current);
      offsetRef.current += newLogs.length;

      let groupedLogs: { type: 'info' | 'error'; lines: string[] }[] = [];
      for (let log of newLogs) {
        let current = groupedLogs[groupedLogs.length - 1];
        if (!current || current.type != log.level) {
          current = { type: log.level, lines: [] };
          groupedLogs.push(current);
        }

        current.lines.push(log.message);
      }

      return {
        status: status.data.status,
        logs: groupedLogs
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

      return {
        capabilities: discoverRes.data,
        oauth: oauthRes.data
      };
    },

    get httpEndpoint() {
      return serverUrl.current;
    }
  };
};

export type DenoDeployment = Awaited<ReturnType<typeof createDenoLambdaDeployment>>;
