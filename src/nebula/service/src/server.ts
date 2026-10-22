import { createRequire } from 'module';

(globalThis as any).require = createRequire(import.meta.url);

async function main() {
  await import('./init');
  await import('./instrument');
  await import('./endpoints');
  await import('./worker');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

if (process.env.HEARTBEAT_URL) {
  setInterval(() => {
    fetch(process.env.HEARTBEAT_URL!, { method: 'POST' }).catch(error => {
      console.error('Failed to send heartbeat:', error);
    });
  }, 45 * 1000);
}
