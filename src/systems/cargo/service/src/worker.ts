import { createRequire } from 'module';

let require = createRequire(import.meta.url);
(globalThis as any).require = require;

async function main() {
  await import('./init');
  await import('./instrument');

  let [
    { runQueueProcessors },
    { documentCleanupProcessors },
    { documentFlushProcessors },
    { documentVersionSyncProcessors },
    { storeCleanupProcessors }
  ] = await Promise.all([
    import('@lowerdeck/queue'),
    import('./queues/documentCleanup'),
    import('./queues/documentFlush'),
    import('./queues/documentVersionSync'),
    import('./queues/storeCleanup')
  ]);

  await runQueueProcessors([
    documentFlushProcessors,
    documentCleanupProcessors,
    documentVersionSyncProcessors,
    storeCleanupProcessors
  ]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
