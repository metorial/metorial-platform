import { db } from '@metorial/db';
import { secretService } from '@metorial/module-secret';
import { createQueue } from '@metorial/queue';

export let serverDeploymentDeletedQueue = createQueue<{
  serverDeploymentId: string;
  performedById: string;
}>({
  name: 'srd/depl/create'
});

export let serverDeploymentDeletedQueueProcessor = serverDeploymentDeletedQueue.process(
  async data => {
    let deployment = await db.serverDeployment.findUnique({
      where: { id: data.serverDeploymentId },
      include: {
        instance: true,
        config: true
      }
    });
    if (!deployment) throw new Error('retry ... not found');

    let actor = await db.organizationActor.findUnique({
      where: { id: data.performedById }
    });
    if (!actor) throw new Error('retry ... not found');

    await secretService.deleteSecret({
      performedBy: actor,
      secret: await secretService.getSecretById({
        instance: deployment.instance,
        secretId: deployment.config.configSecretOid
      })
    });
  }
);
