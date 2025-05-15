import {
  ServerDeployment,
  ServerInstance,
  ServerVariant,
  type ServerSession
} from '@metorial/db';
import { debug } from '@metorial/debug';
import { createQueue } from '@metorial/queue';
import { getRunnerQueue } from '../../gateway/runnerQueue';

let brokerRunnerHostedQueue = createQueue<{
  session: ServerSession;
}>({
  name: 'srr/run/host',
  workerOpts: {
    concurrency: 5000
  },
  queueOpts: {
    defaultJobOptions: {
      attempts: 3
    }
  }
});

export let ensureHostedRunner = (
  session: ServerSession & {
    serverDeployment: ServerDeployment & {
      serverInstance: ServerInstance & {
        serverVariant: ServerVariant;
      };
    };
  }
) => {
  brokerRunnerHostedQueue
    .add(
      {
        session: {
          ...session,

          // @ts-ignore
          serverDeployment: undefined
        }
      },
      { id: session.id }
    )
    .catch(err => {
      debug.error('Failed to add broker run job', err);
    });
};

export let brokerRunnerHostedQueueProcessor = brokerRunnerHostedQueue.process(async data => {
  // TODO: find runner for session

  getRunnerQueue(runner)
    .startSessionRun(data.session)
    .catch(err => {
      debug.error('Failed to add broker run job', err);
    });
});
