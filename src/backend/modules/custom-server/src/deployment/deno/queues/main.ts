import { db, ID, ServerVersion, withTransaction } from '@metorial/db';
import { delay } from '@metorial/delay';
import { providerOauthConfigService } from '@metorial/module-provider-oauth';
import { createQueue } from '@metorial/queue';
import { getSentry } from '@metorial/sentry';
import { useDeploymentQueue } from '../../../lib/useDeploymentQueue';
import { customServerVersionService } from '../../../services';
import { DeploymentError } from '../../base/error';
import { createDenoLambdaDeployment, DenoDeployment } from '../deployment';

let Sentry = getSentry();

export let denoDeployMainQueue = createQueue<{
  lambdaId: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
}>({
  name: 'csrv/deno/main',
  jobOpts: {
    attempts: 10
  },
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 30 * 1000
    }
  }
});

export let denoDeployMainQueueProcessor = denoDeployMainQueue.process(async data => {
  let { failDeployment, stepManager, lambda, customServerVersion, deployment } =
    await useDeploymentQueue({
      lambdaId: data.lambdaId,
      serverVersionData: data.serverVersionData
    });

  let checkStep = await stepManager.createDeploymentStep({
    type: 'lambda_deploy_create',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Preparing deployment for managed server...`]
      }
    ]
  });

  let deno: DenoDeployment;

  try {
    deno = await createDenoLambdaDeployment({
      lambdaServerInstance: lambda,
      customServer: customServerVersion.customServer,
      deployment
    });

    checkStep.complete([]);
  } catch (error: any) {
    console.error('Error during managed server deployment setup:', error);

    if (error instanceof DeploymentError) {
      await checkStep.fail([
        {
          type: 'error',
          lines: [error.message]
        }
      ]);
      await failDeployment();
      return;
    }

    if (error.response && error.response.data && error.response.data.message) {
      await checkStep.fail([
        {
          type: 'error',
          lines: [error.response.data.message]
        }
      ]);
    }
    Sentry.captureException(error);
    await failDeployment();
    return;
  }

  let buildStep = await stepManager.createDeploymentStep({
    type: 'lambda_deploy_build',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Building and deploying managed server...`]
      }
    ]
  });

  try {
    while (true) {
      await delay(2000);
      let status = await deno.pollDeploymentStatus();

      for (let log of status.logs) {
        buildStep.addLog(log.lines, log.type);
      }

      if (status.status == 'success') {
        buildStep.complete([
          {
            type: 'info',
            lines: ['Managed server deployed successfully.']
          }
        ]);
        break;
      } else if (status.status == 'failed') {
        buildStep.fail([
          {
            type: 'info',
            lines: ['Deployment failed.']
          }
        ]);
        await failDeployment();
        return;
      }
    }
  } catch (error: any) {
    Sentry.captureException(error);
    await buildStep.fail();
    await failDeployment();
    return;
  }

  let discoverStep = await stepManager.createDeploymentStep({
    type: 'discovering',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Discovering server capabilities...`]
      }
    ]
  });

  try {
    let { capabilities, oauth, callbacks } = await deno.discoverServer();
    data.serverVersionData.tools = capabilities.tools ?? [];
    data.serverVersionData.resourceTemplates = capabilities.resourceTemplates ?? [];
    data.serverVersionData.prompts = capabilities.prompts ?? [];
    data.serverVersionData.serverCapabilities = capabilities.capabilities ?? [];
    data.serverVersionData.serverInfo = capabilities.implementation ?? [];
    data.serverVersionData.serverInstructions = capabilities.instructions || null;
    await discoverStep.addLog([`Server capabilities discovered successfully.`], 'info');
    await discoverStep.addLog(JSON.stringify(capabilities, null, 2).split('\n'), 'info');

    if (oauth.enabled) {
      let config = await providerOauthConfigService.createConfig({
        instance: lambda.instance,
        implementation: {
          type: 'managed_server_http',
          httpEndpoint: deno.httpEndpoint,
          hasRemoteOauthForm: !!oauth.hasForm,
          lambdaServerInstanceOid: lambda.oid
        }
      });

      await db.lambdaServerInstance.updateMany({
        where: { id: lambda.id },
        data: {
          providerOAuthConfigOid: config.oid
        }
      });

      await discoverStep.addLog(
        ['Server implements custom OAuth. OAuth configuration created successfully.'],
        'info'
      );
    } else if (lambda.providerOAuthConfigOid) {
      let currentOauthConfig = await db.providerOAuthConfig.findFirstOrThrow({
        where: { oid: lambda.providerOAuthConfigOid }
      });

      // If the server used to be oauth enabled but isn't anymore,
      // we remove the config from the lambda
      if (currentOauthConfig.type == 'managed_server_http') {
        await db.lambdaServerInstance.updateMany({
          where: { id: lambda.id },
          data: {
            providerOAuthConfigOid: null
          }
        });
      }
    }

    if (callbacks.enabled) {
      let callbackTemplate = await db.callbackTemplate.create({
        data: {
          id: await ID.generateId('callbackTemplate'),
          eventType: callbacks.type
        }
      });

      await db.lambdaServerInstance.updateMany({
        where: { id: lambda.id },
        data: {
          callbackTemplateOid: callbackTemplate.oid
        }
      });

      await discoverStep.addLog(['Discovered server callback support.'], 'info');
    }

    await discoverStep.complete();
  } catch (error: any) {
    console.error('Error during managed server discovery:', error);
    Sentry.captureException(error);

    if (error?.response?.data?.message) {
      await discoverStep.addLog([error.response.data.message], 'error');
    }

    await discoverStep.fail([
      {
        type: 'error',
        lines: [`Managed server discovery failed.`]
      }
    ]);
    await failDeployment();
    return;
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

      let currentLambda = await db.lambdaServerInstance.findFirstOrThrow({
        where: { id: lambda.id }
      });

      let serverVersion = await db.serverVersion.create({
        data: {
          ...data.serverVersionData,
          lambdaOid: lambda.oid,
          oauthCredentialProvider: currentLambda.providerOAuthConfigOid ? 'manual' : 'none'
        }
      });

      let version = await db.customServerVersion.update({
        where: { id: customServerVersion.id },
        data: {
          status: 'available',
          serverVersionOid: serverVersion.oid,
          oauthCredentialProvider: serverVersion.oauthCredentialProvider
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
          lines: [`Managed server deployed to Metorial successfully.`]
        }
      ]
    });
  } catch (error: any) {
    console.error('Error during managed server deployment:', error);
    Sentry.captureException(error);
    await deploymentStep.fail([
      {
        type: 'error',
        lines: [`Managed server deployment failed.`]
      }
    ]);
    await failDeployment();
    return;
  }
});
