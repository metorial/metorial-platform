import path from 'node:path';
import workerThreads from 'node:worker_threads';
import { codedError } from './control';
import { installNetwork } from './network';

// The bundler inlines __filename at build time, so the running file comes from argv on the
// main thread and from the --require this module added on worker threads.
let bootstrapFile = () => {
  if (workerThreads.isMainThread) return path.resolve(process.argv[1]!);
  return process.execArgv[process.execArgv.lastIndexOf('--require') + 1]!;
};

// Worker threads have no request context, so they get no route out: each one preloads this
// bootstrap, which in a worker installs interception that refuses every connection and lookup.
export let installWorkerThreads = () => {
  let file = bootstrapFile();
  let Original = workerThreads.Worker;

  class Worker extends Original {
    constructor(filename: string | URL, options: workerThreads.WorkerOptions = {}) {
      super(filename, {
        ...options,
        execArgv: [...(options.execArgv ?? process.execArgv), '--require', file]
      });
    }
  }

  (workerThreads as any).Worker = Worker;
};

export let denyWorkerThreadNetwork = () => {
  installNetwork(
    {
      trackTunnel() {},
      lookup: hostname =>
        Promise.reject(
          codedError(
            `getaddrinfo ENOTFOUND ${hostname} (worker threads have no network access)`,
            {
              code: 'ENOTFOUND',
              syscall: 'getaddrinfo',
              hostname
            }
          )
        )
    },
    '/nonexistent'
  );
  installWorkerThreads();
};
