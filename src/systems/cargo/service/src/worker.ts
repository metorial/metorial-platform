import { runQueueProcessors } from '@lowerdeck/queue';
import { createRequire } from 'module';
import { documentCleanupProcessors } from './queues/documentCleanup';
import { documentFlushProcessors } from './queues/documentFlush';
import { documentVersionSyncProcessors } from './queues/documentVersionSync';
import { storeCleanupProcessors } from './queues/storeCleanup';

let require = createRequire(import.meta.url);
(globalThis as any).require = require;

async function main() {
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
