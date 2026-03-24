import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, withTransaction } from '@metorial-subspace/db';
import { actorService } from '@metorial-subspace/module-tenant';
import { env } from '../../env';
import { customProviderCommitService } from '../../services';

export let customDeploymentPropagateToOtherEnvironmentsQueue = createQueue<{
  customProviderDeploymentId: string;
}>({
  name: 'sub/cpr/deployment/prop-other-envs',
  redisUrl: env.service.REDIS_URL
});

export let customDeploymentPropagateToOtherEnvironmentsQueueProcessor =
  customDeploymentPropagateToOtherEnvironmentsQueue.process(async data => {
    let deployment = await db.customProviderDeployment.findFirst({
      where: { id: data.customProviderDeploymentId },
      include: {
        scmRepoPush: true,
        commit: {
          include: {
            toEnvironment: true
          }
        },
        tenant: true,
        solution: true
      }
    });
    if (!deployment) throw new QueueRetryError();

    // If the deployment is linked to an scm push, there might be other environments
    // that also want to receive the deployment since they track the same branch
    // Then we need to make sure those environments also get the new version deployed
    // via commits
    if (!deployment.scmRepoPush || !deployment.commit) return;

    let envs = await db.customProviderEnvironment.findMany({
      where: {
        customProviderOid: deployment.customProviderOid,
        branchName: deployment.scmRepoPush.branchName,
        environment: {
          NOT: { oid: deployment.commit.toEnvironmentOid }
        }
      },
      include: { environment: true }
    });
    if (!envs.length) return;

    let actor = await actorService.getSystemActor({
      tenant: deployment.tenant
    });

    await withTransaction(async db => {
      for (let env of envs) {
        await customProviderCommitService.createCustomProviderCommit({
          actor,
          tenant: deployment.tenant,
          solution: deployment.solution,
          environment: env.environment,
          input: {
            message: `Propagate Git deployment (sha: ${deployment.scmRepoPush!.sha})`,
            action: {
              type: 'merge_version_into_environment',
              fromEnvironment: deployment.commit!.toEnvironment,
              toEnvironment: env
            }
          },

          _internal: {
            trigger: 'scm',
            scmPush: deployment.scmRepoPush!
          }
        });
      }
    });
  });
