import { createRequire } from 'module';

let require = createRequire(import.meta.url);
(globalThis as any).require = require;

async function main() {
  await import('./init');
  await import('./boot');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
