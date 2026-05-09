import { createRequire } from 'module';

let require = createRequire(import.meta.url);
(globalThis as any).require = require;

async function main() {
  await import('./init');
  await import('./instrument');

  let [{ runQueueProcessors }, { documentCleanupProcessors }, { documentFlushProcessor }] = await Promise.all([
    import('@lowerdeck/queue'),
    import('./queues/documentCleanup'),
    import('./queues/documentFlush')
  ]);

  await runQueueProcessors([documentFlushProcessor, documentCleanupProcessors]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
