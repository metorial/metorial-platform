import { runQueueProcessors } from '@lowerdeck/queue';
import { createRequire } from 'module';
import { documentCleanupProcessors } from './queues/documentCleanup';
import { documentFlushProcessors } from './queues/documentFlush';
import { documentVersionSyncProcessors } from './queues/documentVersionSync';
import { storeCleanupProcessors } from './queues/storeCleanup';
import { storeVersionProcessors } from './queues/storeVersion';

let require = createRequire(import.meta.url);
(globalThis as any).require = require;

async function main() {
  await runQueueProcessors([
    documentFlushProcessors,
    documentCleanupProcessors,
    documentVersionSyncProcessors,
    storeCleanupProcessors,
    storeVersionProcessors
  ]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
