import {
  CustomServerDeployment,
  CustomServerDeploymentStep,
  CustomServerDeploymentStepStatus,
  CustomServerDeploymentStepType,
  db,
  ID,
  ServerVersion,
  withTransaction
} from '@metorial/db';
import {
  providerOauthConfigService,
  providerOauthDiscoveryService
} from '@metorial/module-provider-oauth';
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
  },
  workerOpts: {
    concurrency: 100
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
      let upsertLogs = (current: CustomServerDeploymentStep | undefined, logs: Logs) => {
        let currentLogs = current?.logs || [];

        for (let log of logs) {
          currentLogs.push([
            Date.now(),
            log.lines,
            ...(log.type == 'error' ? [1] : [])
          ] as any);
        }

        if (current) current.logs = currentLogs;

        return currentLogs;
      };

      let step = await db.customServerDeploymentStep.create({
        data: {
          id: await ID.generateId('customServerDeploymentStep'),
          type: d.type,
          status: d.status ?? 'running',
          index: indexRef.current++,
          deploymentOid: opts.deployment.oid,
          startedAt: new Date(),
          endedAt: d.status == 'completed' ? new Date() : null,
          logs: upsertLogs(undefined, d.log || [])
        }
      });

      let setStatus = async (status: CustomServerDeploymentStepStatus, logs?: Logs) => {
        if (step.status != 'running') return;

        step.status = status;
        step.endedAt = new Date();
        if (logs) step.logs = upsertLogs(step, logs);

        await db.customServerDeploymentStep.updateMany({
          where: { oid: step.oid },
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
          let updatedLogs = upsertLogs(step, [{ type, lines: log }]);

          await db.customServerDeploymentStep.updateMany({
            where: { id: step.id },
            data: { logs: updatedLogs }
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
      instance: true,
      customServerVersion: {
        include: {
          deployment: true,
          customServer: true
        }
      }
    }
  });
  if (!remote) return;

  let instance = remote.instance;

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

    await db.customServerDeploymentStep.updateMany({
      where: { deploymentOid: deployment.oid, status: 'running' },
      data: { status: 'failed', endedAt: new Date() }
    });
  };

  let stepManager = createDeploymentStepManager({ deployment });

  await stepManager.createDeploymentStep({
    type: 'started',
    status: 'completed',
    log: [
      {
        type: 'info',
        lines: [`Starting deployment for remote server ${remote.remoteUrl}.`]
      }
    ]
  });

  let checkStep = await stepManager.createDeploymentStep({
    type: 'remote_server_connection_test',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Running connection test for remote server...`]
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

  if (!remote.providerOAuthConfigOid) {
    let discoveryStep = await stepManager.createDeploymentStep({
      type: 'remote_oauth_auto_discovery',
      status: 'running',
      log: [
        {
          type: 'info',
          lines: [`Attempting to discover OAuth configuration from remote server...`]
        }
      ]
    });

    try {
      let autoDiscoveryRes =
        await providerOauthDiscoveryService.discoverOauthConfigWithoutRegistrationSafe({
          discoveryUrl: remote.remoteUrl
        });

      if (autoDiscoveryRes) {
        let config = await providerOauthConfigService.createConfig({
          instance,
          config: autoDiscoveryRes.config,
          scopes: []
        });

        await db.remoteServerInstance.updateMany({
          where: { id: remote.id },
          data: {
            providerOAuthDiscoveryStatus: 'completed_config_found',
            providerOAuthConfigOid: config.oid
          }
        });

        await discoveryStep.complete([
          {
            type: 'info',
            lines: [
              `OAuth configuration:`,
              ` - Provider Name: ${autoDiscoveryRes.providerName}`,
              ` - Provider URL: ${autoDiscoveryRes.providerUrl}`,
              'Metorial has successfully discovered the OAuth configuration from the remote server.'
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
      console.error('Error during OAuth discovery:', error);
      Sentry.captureException(error);
      await discoveryStep.fail();
      await failDeployment();
      return;
    }
  }

  let deploymentStep = await stepManager.createDeploymentStep({
    type: 'deploying',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: ['Deploying custom server to Metorial...']
      }
    ]
  });

  try {
    await withTransaction(async db => {
      await deploymentStep.addLog(['Creating server version...']);

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

      await deploymentStep.addLog(['Updating current version...']);

      await customServerVersionService.setCurrentVersion({
        server: customServerVersion.customServer,
        isEphemeralUpdate: true,
        version
      });

      await db.customServerDeployment.updateMany({
        where: { id: deployment.id },
        data: {
          status: 'completed',
          endedAt: new Date()
        }
      });

      await db.customServerDeploymentStep.updateMany({
        where: { deploymentOid: deployment.oid, status: 'running' },
        data: { status: 'completed', endedAt: new Date() }
      });
    });

    await deploymentStep.complete();

    await stepManager.createDeploymentStep({
      type: 'deployed',
      status: 'completed',
      log: [
        {
          type: 'info',
          lines: [`Remote server deployed to Metorial successfully.`]
        }
      ]
    });
  } catch (error: any) {
    console.error('Error during remote server deployment:', error);
    Sentry.captureException(error);
    await deploymentStep.fail([
      {
        type: 'error',
        lines: [`Remote server deployment failed.`]
      }
    ]);
    await failDeployment();
    return;
  }
});
