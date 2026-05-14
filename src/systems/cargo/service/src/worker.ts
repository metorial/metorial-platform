import { runQueueProcessors } from '@lowerdeck/queue';
import { createRequire } from 'module';
import { documentCleanupProcessors } from './queues/documentCleanup';
import { documentDraftVersionFlushProcessors } from './queues/documentDraftVersionFlush';
import { documentFlushProcessors } from './queues/documentFlush';
import { documentVersionSyncProcessors } from './queues/documentVersionSync';
import { storeCleanupProcessors } from './queues/storeCleanup';
import { storeTemplateSyncProcessors } from './queues/storeTemplateSync';
import { storeVersionProcessors } from './queues/storeVersion';

let require = createRequire(import.meta.url);
(globalThis as any).require = require;

async function main() {
  await runQueueProcessors([
    documentFlushProcessors,
    documentDraftVersionFlushProcessors,
    documentCleanupProcessors,
    documentVersionSyncProcessors,
    storeCleanupProcessors,
    storeTemplateSyncProcessors,
    storeVersionProcessors
  ]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
