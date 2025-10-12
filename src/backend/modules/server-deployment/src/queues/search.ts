import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { searchService } from '@metorial/module-search';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let serverDeploymentIndexSingleQueue = createQueue<{ serverDeploymentId: string }>({
  name: 'srd/dep/idx/sgl',
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 50,
      duration: 1000
    }
  }
});

export let serverDeploymentIndexSingleQueueProcessor =
  serverDeploymentIndexSingleQueue.process(async data => {
    let deployment = await db.serverDeployment.findUnique({
      where: { id: data.serverDeploymentId },
      include: {
        server: true,
        instance: true
      }
    });
    if (!deployment) throw new QueueRetryError();
    if (deployment.isEphemeral) return;

    await searchService.indexDocument({
      index: 'server_deployment',
      document: {
        id: deployment.id,
        name: deployment.name ?? deployment.server.name,
        description: deployment.description ?? deployment.server.description,
        serverName: deployment.server.name,
        serverDescription: deployment.server.description,

        instanceId: deployment.instance.id
      }
    });
  });

export let serverDeploymentIndexAllQueue = createQueue<{
  afterId?: string;
  indexOid?: bigint;
}>({
  name: 'srd/dep/idx/all'
});

export let serverDeploymentIndexAllQueueProcessor = serverDeploymentIndexAllQueue.process(
  async data => {
    let index = data.indexOid
      ? await db.serverDeploymentOrInstanceIndexJob.findUnique({
          where: { oid: data.indexOid }
        })
      : await db.serverDeploymentOrInstanceIndexJob.create({
          data: {
            type: 'server_deployment',
            status: 'pending'
          }
        });

    let deployments = await db.serverDeployment.findMany({
      where: {
        id: data.afterId ? { gt: data.afterId } : undefined,
        isEphemeral: false
      },
      take: 500,
      orderBy: {
        id: 'asc'
      },
      select: { id: true }
    });
    await db.serverDeploymentOrInstanceIndexJob.update({
      where: { oid: index!.oid },
      data: {
        count: { increment: deployments.length },
        status: deployments.length == 0 ? 'finished' : 'pending'
      }
    });
    if (deployments.length == 0) return;

    await serverDeploymentIndexSingleQueue.addMany(
      deployments.map(d => ({ serverDeploymentId: d.id }))
    );

    await serverDeploymentIndexAllQueue.add({
      afterId: deployments[deployments.length - 1].id,
      indexOid: index!.oid
    });
  }
);

export let serverImplementationIndexSingleQueue = createQueue<{
  serverImplementationId: string;
}>({
  name: 'srd/imp/idx/sgl',
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 50,
      duration: 1000
    }
  }
});

export let serverImplementationIndexSingleQueueProcessor =
  serverImplementationIndexSingleQueue.process(async data => {
    let implementation = await db.serverImplementation.findUnique({
      where: { id: data.serverImplementationId },
      include: {
        server: true,
        instance: true
      }
    });
    if (!implementation) throw new QueueRetryError();
    if (implementation.isEphemeral) return;

    await searchService.indexDocument({
      index: 'server_implementation',
      document: {
        id: implementation.id,
        name: implementation.name ?? implementation.server.name,
        description: implementation.description ?? implementation.server.description,
        serverName: implementation.server.name,
        serverDescription: implementation.server.description,

        instanceId: implementation.instance.id
      }
    });
  });

export let serverImplementationIndexAllQueue = createQueue<{
  afterId?: string;
  indexOid?: bigint;
}>({
  name: 'srd/imp/idx/all'
});

export let serverImplementationIndexAllQueueProcessor =
  serverImplementationIndexAllQueue.process(async data => {
    let index = data.indexOid
      ? await db.serverDeploymentOrInstanceIndexJob.findUnique({
          where: { oid: data.indexOid }
        })
      : await db.serverDeploymentOrInstanceIndexJob.create({
          data: {
            type: 'server_deployment',
            status: 'pending',
            count: 0
          }
        });

    let implementations = await db.serverImplementation.findMany({
      where: {
        id: data.afterId ? { gt: data.afterId } : undefined,
        isEphemeral: false
      },
      take: 500,
      orderBy: {
        id: 'asc'
      },
      select: { id: true }
    });
    await db.serverDeploymentOrInstanceIndexJob.update({
      where: { oid: index!.oid },
      data: {
        count: { increment: implementations.length },
        status: implementations.length == 0 ? 'finished' : 'pending'
      }
    });

    if (implementations.length == 0) return;

    await serverImplementationIndexSingleQueue.addMany(
      implementations.map(d => ({ serverImplementationId: d.id }))
    );

    await serverImplementationIndexAllQueue.add({
      afterId: implementations[implementations.length - 1].id,
      indexOid: index!.oid
    });
  });

export let serverIndexCron = createCron(
  {
    name: 'srd/idx/crn',
    cron: '0 1 * * *'
  },
  async () => {
    await serverDeploymentIndexAllQueue.add({});
    await serverImplementationIndexAllQueue.add({});
  }
);

export let indexServerDeployments = async () => {
  await serverDeploymentIndexAllQueue.add({});
  await serverImplementationIndexAllQueue.add({});
};
