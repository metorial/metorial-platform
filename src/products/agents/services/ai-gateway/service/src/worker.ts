import { runQueueProcessors } from '@lowerdeck/queue';

async function main() {
  await runQueueProcessors([]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
