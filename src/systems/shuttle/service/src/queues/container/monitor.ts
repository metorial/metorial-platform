import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { DeploymentManagerStep } from '../../lib/deployment';
import { versionIdentifier } from '../../lib/identifier/version';
import { deployServerFailedQueue } from '../deployment/failed';
import { deployServerSucceededQueue } from '../deployment/succeeded';
import { serverVersionCreatedQueue } from '../lifecycle/serverVersion';

export let deployContainerServerWatchQueue = createQueue<{
  tagId: string;
  serverDeploymentId: string;
  deployingStepId: string;
}>({
  name: 'shut/con-ser/deploy/watch',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000
    }
  }
});

export let deployContainerServerWatchQueueProcessor = deployContainerServerWatchQueue.process(
  async data => {
    let tag = await db.containerRepositoryTag.findFirst({
      where: { id: data.tagId },
      include: {
        lastDiscoveryError: true,
        currentVersion: true
      }
    });
    if (!tag) throw new QueueRetryError();

    if (tag.discoveryStatus == 'failed') {
      let step = await DeploymentManagerStep.of({
        stepId: data.deployingStepId
      });

      step.log([
        `Container tag discovery failed for image ref ${data.tagId}.`,
        `Error Code: ${tag.lastDiscoveryError?.code}`,
        `Message: ${tag.lastDiscoveryError?.message}`
      ]);
      step.fail();

      await deployServerFailedQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
      return;
    }

    if (tag.discoveryStatus == 'pending' || !tag.currentVersion) {
      await deployContainerServerWatchQueue.add(data, { delay: 1000 });
      return;
    }

    let deployment = await db.serverDeployment.findFirst({
      where: { id: data.serverDeploymentId },
      include: { server: true }
    });
    if (!deployment) throw new QueueRetryError();
    let server = deployment.server;

    let identifier = versionIdentifier.docker({
      server,
      repositoryTag: tag,
      repositoryVersion: tag.currentVersion
    });

    let step = await DeploymentManagerStep.of({
      stepId: data.deployingStepId
    });

    let newId = getId('serverVersion');
    let version = await db.serverVersion.upsert({
      where: {
        serverOid_identifier: { serverOid: server.oid, identifier }
      },
      create: {
        ...newId,

        identifier,

        configSchema: server.draftConfigSchema,
        configTransformer: server.draftConfigTransformer,

        serverOid: server.oid,
        tenantOid: server.tenantOid,
        repositoryTagOid: server.draftRepositoryTagOid,
        repositoryVersionOid: tag.currentVersion.oid,
        deploymentOid: deployment?.oid
      },
      update: {
        repositoryVersionOid: tag.currentVersion.oid
      }
    });

    if (version.deploymentOid == deployment.oid) {
      await serverVersionCreatedQueue.add({
        serverVersionId: version.id
      });

      step.log([
        `Container registry tag successfully discovered. Pinning to server version to digest ${tag.currentVersion?.digest}.`,
        server.tenantOid
          ? `New digests for tag '${tag.tag}' will trigger new deployments.`
          : 'Public servers are pinned; new digests will not trigger automatic redeployments.',
        'MCP server deployment succeeded.'
      ]);
      step.succeed();

      await deployServerSucceededQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    } else {
      step.log([
        `Version has already been discovered for digest ${tag.currentVersion?.digest}.`
      ]);
      step.fail();

      await deployServerFailedQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    }
  }
);
