import { type ServerSession } from '@metorial/db';
import { debug } from '@metorial/debug';
import { createQueue } from '@metorial/queue';
import { BrokerRunnerImplementationExternal } from '../implementations/external';
import { BrokerRunManager } from '../manager';
import { RunJobProcessorUtils } from '../runJobProcessorUtils';

let brokerRunnerExternalQueue = createQueue<{
  serverSessionId: string;
}>({
  name: 'srr/run/ext',
  workerOpts: {
    concurrency: 5000,
    stalledInterval: 5000,
    maxStalledCount: 5
  },
  queueOpts: {
    defaultJobOptions: {
      attempts: 3
    }
  }
});

export let ensureExternalRunner = (session: ServerSession) => {
  brokerRunnerExternalQueue
    .add({ serverSessionId: session.id }, { id: session.id })
    .catch(err => {
      debug.error('Failed to add broker run job', err);
    });
};

export let brokerRunnerExternalQueueProcessor = brokerRunnerExternalQueue.process(
  async data => {
    let info = await RunJobProcessorUtils.createServerRun({
      serverSessionId: data.serverSessionId
    });
    if (!info) return;

    let impl = await BrokerRunnerImplementationExternal.create(info.serverRun, {
      url: info.version.remoteUrl!,
      transport: 'mcp/sse'
    });

    let manager = new BrokerRunManager(
      impl,
      info.serverRun,
      info.session,
      info.version,
      info.session.instance
    );

    await manager.waitForClose;
  }
);
