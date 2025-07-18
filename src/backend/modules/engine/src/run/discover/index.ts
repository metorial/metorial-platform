import { db, ID } from '@metorial/db';
import { internalServerError, ServiceError } from '@metorial/error';
import { secretService } from '@metorial/module-secret';
import { getSentry } from '@metorial/sentry';
import { InitializeResult } from '@modelcontextprotocol/sdk/types';
import { subMinutes } from 'date-fns';
import { getClientByHash } from '../client';
import { getSessionConfig } from '../config';

let Sentry = getSentry();

export let discoverServer = async (serverDeploymentId: string) => {
  let serverDeployment = await db.serverDeployment.findFirst({
    where: { id: serverDeploymentId },
    include: {
      config: true,
      serverVariant: {
        include: { currentVersion: true }
      },
      serverImplementation: true,
      instance: true
    }
  });
  if (!serverDeployment) throw new Error('WTF - Missing server deployment');
  if (!serverDeployment.serverVariant.currentVersion)
    throw new Error('WTF - Missing current server version');

  let discoveryInterval = subMinutes(new Date(), 15);
  if (
    serverDeployment.serverVariant.lastDiscoveredAt &&
    serverDeployment.serverVariant.lastDiscoveredAt > discoveryInterval
  ) {
    return serverDeployment;
  }

  let id = await ID.generateId('serverAutoDiscoveryJob');

  let { secret, data: DANGEROUSLY_UNENCRYPTED_CONFIG } =
    await secretService.DANGEROUSLY_readSecretValue({
      secretId: serverDeployment.config.configSecretOid,
      instance: serverDeployment.instance,
      type: 'server_deployment_config',
      metadata: { discoveryId: id }
    });

  let config = await getSessionConfig(serverDeployment, DANGEROUSLY_UNENCRYPTED_CONFIG);

  let client = getClientByHash(serverDeployment.serverVariant.identifier);
  if (!client) {
    throw new ServiceError(
      internalServerError({
        message: 'Unable run the server for discovery.',
        reason: 'mtengine/no_manager'
      })
    );
  }

  try {
    let { server: report } = await client.discoverServer({
      serverConfig: config['serverConfig']
    });
    if (!report) throw new Error('Manager did not return a server discovery report');

    let serverInfo: InitializeResult = JSON.parse(report.mcpServer?.participantJson ?? '{}');

    let data = {
      tools: report.tools.map(t => JSON.parse(t.json)),
      prompts: report.prompts.map(t => JSON.parse(t.json)),
      resourceTemplates: report.resourceTemplates.map(t => JSON.parse(t.json)),

      serverCapabilities: serverInfo.capabilities,
      serverInfo: serverInfo.serverInfo,

      lastDiscoveredAt: new Date()
    };

    let updatedVariant = await db.serverVariant.update({
      where: { oid: serverDeployment.serverVariant.oid },
      data
    });

    let updatedVersion = await db.serverVersion.update({
      where: { oid: serverDeployment.serverVariant.currentVersion!.oid },
      data
    });

    serverDeployment.serverVariant = {
      ...updatedVariant,
      currentVersion: updatedVersion
    };

    await db.serverAutoDiscoveryJob.create({
      data: {
        id,
        status: 'completed',
        serverDeploymentOid: serverDeployment.oid,
        serverVariantOid: serverDeployment.serverVariant.oid
      }
    });

    return serverDeployment;
  } catch (error: any) {
    Sentry.captureException(error, {
      extra: {
        serverDeploymentOid: serverDeployment.oid,
        serverOid: serverDeployment.serverOid
      }
    });

    await db.serverAutoDiscoveryJob.create({
      data: {
        id,
        status: 'failed',
        serverDeploymentOid: serverDeployment.oid,
        serverVariantOid: serverDeployment.serverVariant.oid,
        internalMetadata: {
          error: error.message
        }
      }
    });

    return null;
  }
};
