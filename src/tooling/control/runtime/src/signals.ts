let handledSignals = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 } as const;

let received: keyof typeof handledSignals | undefined;

export class MigrationInterrupted extends Error {
  exitCode: number;

  constructor(signal: keyof typeof handledSignals) {
    super(`Interrupted by ${signal}`);
    this.exitCode = 128 + handledSignals[signal];
  }
}

export let deferSignals = () => {
  for (let signal of Object.keys(handledSignals) as (keyof typeof handledSignals)[]) {
    process.on(signal, () => {
      if (received) return;

      received = signal;
      console.log(`Received ${signal}; finishing the running migration before exiting`);
    });
  }
};

export let interruption = () => (received ? new MigrationInterrupted(received) : undefined);

export let throwIfInterrupted = () => {
  let error = interruption();
  if (error) throw error;
};
