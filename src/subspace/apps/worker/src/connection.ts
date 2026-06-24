import { startReceiver } from '@metorial-subspace/module-connection';

let receiver = startReceiver();

let DRAIN_TIMEOUT_MS = 25000;
let DRAIN_POLL_MS = 250;

let shuttingDown = false;

let gracefulShutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;

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

    await receiver.stop();
  } catch (err) {
    console.error('CONDUIT.worker.shutdown.error', err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
