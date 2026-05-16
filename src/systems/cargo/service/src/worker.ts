import { runQueueProcessors } from '@lowerdeck/queue';
import { documentQueueProcessor } from '@metorial-cargo/module-doc';
import { fileQueueProcessor } from '@metorial-cargo/module-file';
import { skillQueueProcessor } from '@metorial-cargo/module-skill';
import { storeQueueProcessor } from '@metorial-cargo/module-store';
import { createRequire } from 'module';

// Provide CommonJS `require` in ESM runtime for bundled deps.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
