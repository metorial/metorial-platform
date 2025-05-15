import { db, ID, ServerRun, ServerRunner, withTransaction } from '@metorial/db';
import { secretService } from '@metorial/module-secret';
import { serverRunnerService } from '../services';

export let RunJobProcessorUtils = {
  getServerSession: async (d: { serverSessionId: string }) => {
    return await db.serverSession.findFirst({
      where: { id: d.serverSessionId, status: { in: ['active', 'created'] } },
      include: {
        instance: true,
        serverDeployment: {
          include: {
            serverInstance: {
              include: {
                serverVariant: {
                  include: {
                    currentVersion: true
                  }
                }
              }
            }
          }
        }
      }
    });
  },

  createServerRun: async (d: { serverSessionId: string; runner?: ServerRunner }) => {
    let session = await RunJobProcessorUtils.getServerSession(d);
    if (!session) return null;

    let deployment = session.serverDeployment;
    let instance = deployment.serverInstance;
    let variant = instance.serverVariant;

    let version = variant.currentVersion;
    if (!version) return null;

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

      await db.serverSession.updateMany({
        where: { id: session.id },
        data: { status: 'active' }
      });

      let config = await secretService.DANGEROUSLY_readSecretValue({
        secretId: deployment.configSecretOid,
        instance: session.instance,
        type: 'server_deployment_config',
        metadata: { serverRunnerService }
      });

      return {
        serverRun,
        session,
        variant: session.serverDeployment.serverInstance.serverVariant,
        version,
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
