import { handleBootFailure } from '@metorial/doctor';
import { createRequire } from 'module';

(globalThis as any).require = createRequire(import.meta.url);

async function main() {
  await import('./init');
  await import('./instrument');
  await import('./endpoints');
  await import('./worker');
}

main().catch(error => handleBootFailure('secret-store', error));

if (process.env.HEARTBEAT_URL) {
  setInterval(() => {
    fetch(process.env.HEARTBEAT_URL!, { method: 'POST' }).catch(error => {
      console.error('Failed to send heartbeat:', error);
    });
  }, 45 * 1000);
}
