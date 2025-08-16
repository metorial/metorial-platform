import {
  CustomServerDeployment,
  CustomServerDeploymentStepStatus,
  CustomServerDeploymentStepType,
  db,
  ID,
  ServerVersion,
  withTransaction
} from '@metorial/db';
import { providerOauthDiscoveryService } from '@metorial/module-provider-oauth';
import { createQueue } from '@metorial/queue';
import { getSentry } from '@metorial/sentry';
import { customServerVersionService } from '../services';
import { checkRemote } from './checkRemote';

let Sentry = getSentry();

export let initializeRemoteQueue = createQueue<{
  remoteId: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
}>({
  name: 'csrv/initRem',
  jobOpts: {
    attempts: 10
  }
});

type Logs = {
  lines: string[];
  type?: 'info' | 'error';
}[];

let createDeploymentStepManager = (opts: { deployment: CustomServerDeployment }) => {
  let indexRef = { current: 0 };

  return {
    createDeploymentStep: async (d: {
      type: CustomServerDeploymentStepType;
      status?: CustomServerDeploymentStepStatus;
      log?: Logs;
    }) => {
      let step = await db.customServerDeploymentStep.create({
        data: {
          id: await ID.generateId('customServerDeploymentStep'),
          type: d.type,
          status: d.status ?? 'running',
          index: indexRef.current++,
          deploymentOid: opts.deployment.oid,
          startedAt: new Date(),
          endedAt: d.status == 'completed' ? new Date() : null,
          logs: d.log?.map(l => [Date.now(), l.lines, l.type == 'error' ? 1 : undefined])
        }
      });

      let setStatus = async (status: CustomServerDeploymentStepStatus, logs?: Logs) => {
        if (step.status != 'running') return;

        step.status = status;
        step.endedAt = new Date();

        if (logs) {
          step.logs = step.logs || [];
          for (let log of logs) {
            step.logs.push([Date.now(), log.lines, log.type == 'error' ? 1 : undefined]);
          }
        }

        await db.customServerDeploymentStep.updateMany({
          where: { id: step.id },
          data: {
            status: step.status,
            endedAt: step.endedAt,
            logs: step.logs ?? undefined
          }
        });
      };

      return {
        step,
        complete: (logs?: Logs) => setStatus('completed', logs),
        fail: (logs?: Logs) => setStatus('failed', logs),
        addLog: async (log: string[], type?: 'info' | 'error') => {
          step.logs = step.logs || [];
          step.logs.push([Date.now(), log, type == 'error' ? 1 : undefined]);

          await db.customServerDeploymentStep.updateMany({
            where: { id: step.id },
            data: { logs: step.logs }
          });
        }
      };
    }
  };
};

export let initializeRemoteQueueProcessor = initializeRemoteQueue.process(async data => {
  let remote = await db.remoteServerInstance.findFirst({
    where: { id: data.remoteId },
    include: {
      customServerVersion: {
        include: {
          deployment: true,
          customServer: true
        }
      }
    }
  });
  if (!remote) return;

  let customServerVersion = remote.customServerVersion;
  let deployment = customServerVersion?.deployment;
  if (!customServerVersion || !deployment)
    throw new Error(`Remote server version not found for remote ID: ${data.remoteId}`);

  await db.customServerDeployment.updateMany({
    where: { id: deployment.id },
    data: { status: 'deploying', startedAt: new Date() }
  });

  let failDeployment = async () => {
    await db.customServerDeployment.updateMany({
      where: { id: deployment.id },
      data: { status: 'failed', endedAt: new Date() }
    });

    await db.customServerVersion.updateMany({
      where: { id: customServerVersion.id },
      data: { status: 'deployment_failed' }
    });
  };

  let stepManager = createDeploymentStepManager({ deployment });

  (await stepManager.createDeploymentStep({ type: 'started' })).addLog([
    `Starting deployment for remote server ${remote.remoteUrl}`
  ]);

  let checkStep = await stepManager.createDeploymentStep({
    type: 'remote_server_connection_test',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Running connection test for remote server ...`]
      }
    ]
  });

  try {
    let checkRes = await checkRemote(remote, { createEvent: false });
    if (checkRes.ok) {
      await checkStep.complete([
        {
          type: 'info',
          lines: [
            `Remote server connection test successful.`,
            `Metorial was able to connect to the remote server at ${remote.remoteUrl}.`
          ]
        }
      ]);
    } else {
      await checkStep.fail([
        {
          type: 'error',
          lines: [
            `Remote server connection test failed.`,
            `Metorial was unable to connect to the remote server at ${remote.remoteUrl}.`
          ]
        }
      ]);
      await failDeployment();
      return;
    }
  } catch (error: any) {
    Sentry.captureException(error);
    await checkStep.fail();
    await failDeployment();
    return;
  }

  let discoveryStep = await stepManager.createDeploymentStep({
    type: 'remote_oauth_auto_discovery',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Attempting to discover OAuth configuration from remote server ...`]
      }
    ]
  });

  try {
    let autoDiscoveryRes =
      await providerOauthDiscoveryService.discoverOauthConfigWithoutRegistration({
        discoveryUrl: remote.remoteUrl
      });

    if (autoDiscoveryRes) {
      await db.remoteServerInstance.updateMany({
        where: { id: remote.id },
        data: {
          providerOAuthDiscoveryStatus: 'completed_config_found',
          providerOAuthDiscoveryDocumentOid: autoDiscoveryRes.oid
        }
      });

      await discoveryStep.complete([
        {
          type: 'info',
          lines: [
            `OAuth configuration discovered successfully.`,
            `Provider Name: ${autoDiscoveryRes.providerName}`,
            `Provider URL: ${autoDiscoveryRes.providerUrl}`
          ]
        }
      ]);
    } else {
      await db.remoteServerInstance.updateMany({
        where: { id: remote.id },
        data: { providerOAuthDiscoveryStatus: 'completed_no_config_found' }
      });

      await discoveryStep.complete([
        {
          type: 'info',
          lines: [`No OAuth configuration found for remote server at ${remote.remoteUrl}.`]
        }
      ]);
    }
  } catch (error: any) {
    Sentry.captureException(error);
    await discoveryStep.fail();
    await failDeployment();
    return;
  }

  let deploymentStep = await stepManager.createDeploymentStep({
    type: 'deploying',
    status: 'running'
  });

  try {
    await withTransaction(async db => {
      let serverVersion = await db.serverVersion.create({
        data: data.serverVersionData
      });

      let version = await db.customServerVersion.update({
        where: { id: customServerVersion.id },
        data: {
          status: 'available',
          serverVersionOid: serverVersion.oid
        },
        include: {
          serverVersion: true
        }
      });

      await db.customServerDeployment.updateMany({
        where: { id: deployment.id },
        data: {
          status: 'completed',
          endedAt: new Date()
        }
      });

      await customServerVersionService.setCurrentVersion({
        server: customServerVersion.customServer,
        isEphemeralUpdate: true,
        version
      });
    });

    await deploymentStep.complete();

    await stepManager.createDeploymentStep({
      type: 'deployed',
      status: 'completed',
      log: [
        {
          type: 'info',
          lines: [`Remote server deployment completed successfully.`]
        }
      ]
    });
  } catch (error: any) {
    Sentry.captureException(error);
    await discoveryStep.fail();
    await failDeployment();
    return;
  }
});
