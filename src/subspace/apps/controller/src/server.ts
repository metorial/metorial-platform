import { createRequire } from 'module';

// Provide CommonJS `require` in ESM runtime for bundled deps.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).require = require;

async function main() {
  await import('./init');
  await import('./instrument');
  await import('./endpoints');
  await import('./connection/server');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

if (process.env.HEARTBEAT_URL) {
  let captureHeartbeatError = async (error: unknown) => {
    try {
      let { getSentry } = await import('@lowerdeck/sentry');
      getSentry().captureException(error);
    } catch {}

    console.error('Failed to send heartbeat:', error);
  };

  let sendHeartbeat = async () => {
    try {
      let { checkConduitHeartbeat, checkNatsHealth } =
        await import('@metorial-subspace/module-connection/src/health');

      await checkNatsHealth();
      await checkConduitHeartbeat();
      await fetch(process.env.HEARTBEAT_URL!, { method: 'POST' });
    } catch (error) {
      await captureHeartbeatError(error);
    }
  };

  setInterval(() => {
    void sendHeartbeat();
  }, 45 * 1000); // Send heartbeat every 45 seconds
}
