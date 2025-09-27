import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { discoverServer } from '../run/discover';

let discoverServerDeploymentQueue = createQueue<{
  serverDeploymentId: string;
  serverSessionId?: string;
}>({
  name: 'eng/disc/srdp',
  workerOpts: {
    concurrency: 20,
    limiter: { max: 50, duration: 1000 }
  }
});

export let discoverServerDeploymentQueueProcessor = discoverServerDeploymentQueue.process(
  async data => {
    if (!data) return;

    let serverSession = data.serverSessionId
      ? await db.serverSession.findFirst({
          where: { id: data.serverSessionId },
          include: { serverDeployment: true }
        })
      : null;

    await discoverServer(data.serverDeploymentId, serverSession);
  }
);

export let addServerDeploymentDiscovery = async (data: {
  serverDeploymentId: string;
  serverSessionId?: string;
  delay?: number;
}) => {
  await discoverServerDeploymentQueue.add(
    { serverDeploymentId: data.serverDeploymentId, serverSessionId: data.serverSessionId },
    { id: data.serverDeploymentId, delay: data.delay }
  );
};
