import { createRequire } from 'module';

// Provide CommonJS `require` in ESM runtime for bundled deps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).require = createRequire(import.meta.url);

async function main() {
  await import('./init');
  await import('./boot');

  // Standalone (OSS) only: the enterprise subspace-worker boots `./boot` directly and runs the
  // federation queues in the enterprise worker instead.
  await import('./federationWorker');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
