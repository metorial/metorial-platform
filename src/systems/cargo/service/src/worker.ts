import { runQueueProcessors } from '@lowerdeck/queue';
import { documentQueueProcessor } from '@metorial-cargo/module-doc';
import { fileQueueProcessor } from '@metorial-cargo/module-file';
import { skillQueueProcessor } from '@metorial-cargo/module-skill';
import { storeQueueProcessor } from '@metorial-cargo/module-store';
import { createRequire } from 'module';

let require = createRequire(import.meta.url);
(globalThis as any).require = require;

async function main() {
  await runQueueProcessors([
    fileQueueProcessor,
    documentQueueProcessor,
    storeQueueProcessor,
    skillQueueProcessor
  ]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
