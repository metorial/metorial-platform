import { closeLockPool } from '@lowerdeck/lock';
import { startReceiver } from '@metorial-subspace/module-connection';

let receiver = startReceiver();
let isDevelopment = process.env.METORIAL_ENV === 'development';

let startReceiverWithRetry = async () => {
  let retryDelayMs = 250;

  while (true) {
    try {
      await receiver.started;
      return;
    } catch (error) {
      console.error(`CONDUIT.worker.receiver_start_retry retryInMs=${retryDelayMs}`, error);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      retryDelayMs = Math.min(retryDelayMs * 2, 5_000);
      receiver = startReceiver();
    }
  }
};

if (isDevelopment) {
  await startReceiverWithRetry();
} else {
  // In deployed environments a failed boot must exit so the platform can
  // replace the worker instead of keeping an unregistered process alive.
  await receiver.started;
}

let DRAIN_TIMEOUT_MS = 25000;
let DRAIN_POLL_MS = 250;
let DEV_SUPERVISION_INTERVAL_MS = 5_000;

let shuttingDown = false;
let recoveringReceiver = false;
let receiverSupervisor: Timer | null = null;

if (isDevelopment) {
  receiverSupervisor = setInterval(() => {
    if (shuttingDown || recoveringReceiver) return;

    void (async () => {
      let registered = await receiver.isRegistered().catch(() => false);
      if (receiver.isHealthy() && receiver.isReady() && registered) return;

      recoveringReceiver = true;
      console.warn(
        `CONDUIT.worker.receiver_recover receiverId=${receiver.getReceiverId()} ready=${receiver.isReady()} healthy=${receiver.isHealthy()} registered=${registered}`
      );

      try {
        await receiver.stop();
      } catch (error) {
        console.error('CONDUIT.worker.receiver_recover.stop_failed', error);
      }

      receiver = startReceiver();
      await startReceiverWithRetry();
      recoveringReceiver = false;
      console.log(`CONDUIT.worker.receiver_recovered receiverId=${receiver.getReceiverId()}`);
    })().catch(error => {
      recoveringReceiver = false;
      console.error('CONDUIT.worker.receiver_recover.failed', error);
    });
  }, DEV_SUPERVISION_INTERVAL_MS);
}

let gracefulShutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;

  if (receiverSupervisor) {
    clearInterval(receiverSupervisor);
    receiverSupervisor = null;
  }

  console.log(`CONDUIT.worker.shutdown signal=${signal} draining in-flight messages`);

  let deadline = Date.now() + DRAIN_TIMEOUT_MS;
  try {
    while (Date.now() < deadline) {
      let stats = receiver.getStats();
      if (stats.inFlight === 0) break;
      await new Promise(resolve => setTimeout(resolve, DRAIN_POLL_MS));
    }

    let remaining = receiver.getStats().inFlight;
    console.log(`CONDUIT.worker.shutdown.draining_done remainingInFlight=${remaining}`);

    try {
      await receiver.stop();
    } finally {
      await closeLockPool();
    }
  } catch (err) {
    console.error('CONDUIT.worker.shutdown.error', err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
