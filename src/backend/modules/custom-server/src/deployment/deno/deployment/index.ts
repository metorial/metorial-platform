import {
  CodeBucket,
  CustomServer,
  CustomServerDeployment,
  db,
  Instance,
  LambdaServerInstance
} from '@metorial/db';
import { generatePlainId } from '@metorial/id';
import { createLock } from '@metorial/lock';
import axios from 'axios';
import { env } from '../../../env';
import { getDenoFs } from '../fs';

axios.defaults.headers.common['Accept-Encoding'] = 'gzip';

let deploymentLock = createLock({
  name: 'csrv/deno/dep'
});

export let createDenoLambdaDeployment = async (config: {
  lambdaServerInstance: LambdaServerInstance & {
    immutableCodeBucket: CodeBucket;
    instance: Instance;
  };
  customServer: CustomServer;
  deployment: CustomServerDeployment;
}) => {
  let lambdaServerInstance = config.lambdaServerInstance;

  let deployment = await deploymentLock.usingLock(config.customServer.id, async () => {
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

    let fs = await getDenoFs(lambdaServerInstance);

    let denoDeployment = await axios.post<{
      id: string;
    }>(
      `https://api.deno.com/v1/projects/${project.denoDeployProjectId}/deployments`,
      {
        entryPointUrl: fs.entrypoint,
        envVars: {
          ...fs.env,
          METORIAL_AUTH_TOKEN_SECRET: lambdaServerInstance.securityToken
        },
        description: `CSRV ${config.customServer.id} / DEPL ${config.deployment.id}`,
        permissions: {
          net: ['*']
        },
        domains: ['{project.name}-{deployment.id}.deno.dev'],
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
      },
      {
        headers: {
          Authorization: `Bearer ${env.deno.DENO_DEPLOY_TOKEN}`
        }
      }
    );

    return await db.lambdaServerInstance.update({
      where: { oid: lambdaServerInstance.oid },
      data: {
        status: 'deploying',
        providerInfo: denoDeployment.data,
        providerResourceId: denoDeployment.data.id,

        runtime: 'deno_deploy_v1',
        provider: 'deno_deploy',
        platform: 'metorial_stellar_v1',
        protocol: 'metorial_stellar_over_websocket_v1'
      }
    });
  });

  let offsetRef = { current: 0 };
  let serverUrl = { current: '' };

  return {
    pollDeploymentStatus: async () => {
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
      console.log('Discovering server at', serverUrl.current);

      let discoverUrl = new URL('/discover', serverUrl.current).toString();
      let discoverRes = await axios.get<any>(discoverUrl, {
        headers: {
          'metorial-stellar-token': lambdaServerInstance.securityToken
        },
        timeout: 5000
      });

      console.log({
        discover: discoverRes.data
      });

      let oauthUrl = new URL('/oauth', serverUrl.current).toString();
      let oauthRes = await axios.get<{ enabled: boolean; hasForm: boolean }>(oauthUrl, {
        headers: {
          'metorial-stellar-token': lambdaServerInstance.securityToken
        },
        timeout: 5000
      });

      console.log({
        discover: discoverRes.data,
        oauth: oauthRes.data
      });

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
