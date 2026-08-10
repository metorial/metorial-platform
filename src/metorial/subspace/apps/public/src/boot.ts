export {};

async function main() {
  await import('./endpoints');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

if (process.env.HEARTBEAT_URL) {
  setInterval(() => {
    fetch(process.env.HEARTBEAT_URL!, { method: 'POST' }).catch(error => {
      console.error('Failed to send heartbeat:', error);
    });
  }, 45 * 1000); // Send heartbeat every 45 seconds
}
