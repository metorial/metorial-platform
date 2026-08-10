export {};

async function main() {
  await import('./worker');
  await import('./connection');
  await import('./endpoints');
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
      let { checkNatsHealth, checkConduitSelfHealth } =
        await import('@metorial-subspace/module-connection/src/health');

      await checkNatsHealth();
      await checkConduitSelfHealth();
      await fetch(process.env.HEARTBEAT_URL!, { method: 'POST' });
    } catch (error) {
      await captureHeartbeatError(error);
    }
  };

  setInterval(() => {
    void sendHeartbeat();
  }, 45 * 1000); // Send heartbeat every 45 seconds
}
