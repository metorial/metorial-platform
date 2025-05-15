import { ServerRunner, ServerSession } from '@metorial/db';
import { createQueue, IQueue } from '@metorial/queue';

let queues = new Map<
  string,
  IQueue<{
    task: 'start_session_run';
    serverSessionId: string;
    created: number;
  }>
>();

let getRunnerQueueInternal = (runner: ServerRunner) => {
  let queue = queues.get(runner.id);
  if (queue) return queue;

  queue = createQueue({
    name: `srn/run/${runner.id}`,
    workerOpts: {
      concurrency: 5000,
      stalledInterval: 5000,
      maxStalledCount: 5
    },
    jobOpts: {
      attempts: 1
    }
  });

  return queue;
};

export let getRunnerQueue = (runner: ServerRunner) => {
  let queue = getRunnerQueueInternal(runner);

  return {
    startSessionRun: async (serverSession: ServerSession) =>
      await queue.add(
        {
          task: 'start_session_run',
          serverSessionId: serverSession.id,
          created: Date.now()
        },
        { id: serverSession.id }
      )
  };
};

export let createRunnerQueueProcessor = (
  runner: ServerRunner,
  tasks: {
    start_session_run: (d: { serverSessionId: string }) => Promise<void>;
  }
) => {
  let queue = getRunnerQueueInternal(runner);

  return queue
    .process(async (data, job) => {
      if (data.created + 1000 * 15 < Date.now()) {
        // Job is too old, ignore it
        return;
      }

      if (data.task == 'start_session_run') {
        await tasks.start_session_run({
          serverSessionId: data.serverSessionId
        });
      }
    })
    .start()
    .then(w => w?.close);
};
