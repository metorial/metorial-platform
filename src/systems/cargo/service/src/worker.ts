import { createRequire } from 'module';

let require = createRequire(import.meta.url);
(globalThis as any).require = require;

async function main() {
  await import('./init');
  await import('./instrument');

  let [
    { runQueueProcessors },
    { documentCleanupProcessors },
    { documentFlushProcessor },
    { storeCleanupProcessors }
  ] = await Promise.all([
    import('@lowerdeck/queue'),
    import('./queues/documentCleanup'),
    import('./queues/documentFlush'),
    import('./queues/storeCleanup')
  ]);

  await runQueueProcessors([
    documentFlushProcessor,
    documentCleanupProcessors,
    storeCleanupProcessors
  ]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
