import { db, ID, ServerRun, ServerRunner, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { secretService } from '@metorial/module-secret';
import { getSentry } from '@metorial/sentry';

let Sentry = getSentry();

export let RunJobProcessorUtils = {
  getServerSession: async (d: { serverSessionId: string }) => {
    return await db.serverSession.findFirst({
      where: { id: d.serverSessionId },
      include: {
        instance: { include: { organization: true } },

        serverDeployment: {
          include: {
            config: true,
            serverVariant: {
              include: { currentVersion: true }
            },
            serverImplementation: true
          }
        }
      }
    });
  },

  createServerRun: async (d: { serverSessionId: string; runner?: ServerRunner }) => {
    let session = await RunJobProcessorUtils.getServerSession(d);
    if (!session) return null;

    let deployment = session.serverDeployment;
    let implementation = deployment.serverImplementation;
    let variant = deployment.serverVariant;

    let version = variant.currentVersion;
    if (!version) return null;

    await Fabric.fire('server.server_run.created:before', {
      organization: session.instance.organization,
      instance: session.instance
    });

    return await withTransaction(async db => {
      let serverRun = await db.serverRun.create({
        data: {
          id: await ID.generateId('serverRun'),
          status: 'active',
          type: version.sourceType == 'remote' ? 'external' : 'hosted',
          serverVersionOid: version.oid,
          serverDeploymentOid: deployment.oid,
          instanceOid: session.instance.oid,
          serverSessionOid: session.oid,
          serverRunnerOid: d.runner?.oid
        }
      });

      await Fabric.fire('server.server_run.created:after', {
        serverRun,
        organization: session.instance.organization,
        instance: session.instance
      });

      (async () => {
        await db.serverSession.updateMany({
          where: { id: session.id },
          data: { status: 'running' }
        });
      })().catch(e => {
        Sentry.captureException(e);
        console.error('Failed to create server run', e);
      });

      let config = await secretService.DANGEROUSLY_readSecretValue({
        secretId: deployment.config.configSecretOid,
        instance: session.instance,
        type: 'server_deployment_config',
        metadata: { serverRunId: serverRun.id }
      });

      return {
        serverRun,
        session,
        variant,
        version,
        implementation,
        secret: config.secret,
        DANGEROUSLY_UNENCRYPTED_CONFIG: config.data
      };
    });
  },

  createRunError: async (d: {
    run: ServerRun;
    error: {
      code: string;
      message: string;
      [key: string]: any;
    };
  }) => {
    // TODO: create error and run history event and ensure error group
  }
};
