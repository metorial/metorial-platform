import { createRequire } from 'module';

let require = createRequire(import.meta.url);
(globalThis as any).require = require;

async function main() {
  await import('./init');
  await import('./instrument');
  await import('./endpoints');
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
