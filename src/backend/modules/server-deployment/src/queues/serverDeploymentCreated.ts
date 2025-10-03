import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { serverDeploymentIndexSingleQueue } from './search';

export let serverDeploymentCreatedQueue = createQueue<{ serverDeploymentId: string }>({
  name: 'srd/dep/create'
});

export let serverDeploymentCreatedQueueProcessor = serverDeploymentCreatedQueue.process(
  async data => {
    let deployment = await db.serverDeployment.findUnique({
      where: { id: data.serverDeploymentId }
    });
    if (!deployment) throw new Error('retry ... not found');

    await serverDeploymentIndexSingleQueue.add({
      serverDeploymentId: deployment.id
    });
  }
);
