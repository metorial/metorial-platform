import { isServiceError } from '@lowerdeck/error';
import { createQueue } from '@lowerdeck/queue';
import type { ContainerRepositoryTag } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { DeploymentManager } from '../../lib/deployment';
import { containerRepositoryTagService, secretService } from '../../services';
import { deployServerFailedQueue } from '../deployment/failed';
import { deployContainerServerWatchQueue } from './monitor';

export let deployContainerServerStartQueue = createQueue<{
  serverDeploymentId: string;

  from:
    | {
        type: 'image_ref';
        imageRef: string;
        secretId: string | undefined;
      }
    | {
        type: 'repository_tag';
        repositoryTagId: string;
        digest: string;
      };
}>({
  name: 'shut/con-ser/deploy/start',
  redisUrl: env.service.REDIS_URL
});

export let deployContainerServerStartQueueProcessor = deployContainerServerStartQueue.process(
  async data => {
    let dep = await DeploymentManager.of({ serverDeploymentId: data.serverDeploymentId });

    let startingStep = await dep.step('started');

    if (data.from.type == 'image_ref') {
      startingStep.log('Starting MCP server deployment with Metorial Shuttle.');
    } else {
      startingStep.log(
        `The digest for the repository tag has changed to ${data.from.digest}. Starting MCP server deployment with Metorial Shuttle.`
      );
    }

    await db.serverDeployment.update({
      where: { id: data.serverDeploymentId },
      data: {
        status: 'deploying',
        startedAt: startingStep.step.startedAt
      }
    });
    await startingStep.succeed();

    let tenant = dep.serverDeployment.tenantOid
      ? await db.tenant.findFirstOrThrow({
          where: { oid: dep.serverDeployment.tenantOid }
        })
      : null;

    let deployingStep = await dep.step('deploying');

    try {
      let repositoryTag: ContainerRepositoryTag;

      if (data.from.type == 'image_ref') {
        let secret =
          data.from.secretId && tenant
            ? await secretService.getSecretById({
                tenant,
                id: data.from.secretId
              })
            : null;
        let secretData =
          secret && tenant
            ? await secretService.DANGEROUSLY_decryptSecret({
                secret,
                tenant,
                purpose: 'registry_credentials',
                note: `dep.reg:${dep.serverDeployment.id}:${secret.id}`
              })
            : null;

        repositoryTag = await containerRepositoryTagService.ensureRepositoryTag({
          scope: tenant ? { type: 'tenant', tenant: tenant } : { type: 'global' },
          input: {
            imageRef: data.from.imageRef,
            username: secretData?.username,
            password: secretData?.password
          },
          serverDeploymentId: dep.serverDeployment.id
        });
      } else {
        repositoryTag = await db.containerRepositoryTag.findFirstOrThrow({
          where: { id: data.from.repositoryTagId }
        });
      }

      await db.server.updateMany({
        where: { oid: dep.serverDeployment.serverOid },
        data: {
          draftRepositoryTagOid: repositoryTag.oid
        }
      });

      await deployContainerServerWatchQueue.add({
        serverDeploymentId: data.serverDeploymentId,
        deployingStepId: deployingStep.step.id,
        tagId: repositoryTag.id
      });
    } catch (e) {
      console.error(e);

      deployingStep.log(`MCP server deployment failed.`);
      if (isServiceError(e)) {
        deployingStep.log(`Code: ${e.data.code}`);
        deployingStep.log(`Message: ${e.data.message}`);
      }

      await deployingStep.fail();

      await deployServerFailedQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    }
  }
);
