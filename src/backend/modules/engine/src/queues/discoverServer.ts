import { createQueue } from '@metorial/queue';
import { discoverServer } from '../run/discover';

let discoverServerDeploymentQueue = createQueue<{ serverDeploymentId: string }>({
  name: 'eng/disc/srdp',
  workerOpts: {
    concurrency: 20,
    limiter: { max: 50, duration: 1000 }
  }
});

export let discoverServerDeploymentQueueProcessor = discoverServerDeploymentQueue.process(
  async data => {
    await discoverServer(data.serverDeploymentId);
  }
);

export let addServerDeploymentDiscovery = async (data: {
  serverDeploymentId: string;
  delay?: number;
}) => {
  await discoverServerDeploymentQueue.add(
    { serverDeploymentId: data.serverDeploymentId },
    { id: data.serverDeploymentId, delay: data.delay }
  );
};
