import { createRequire } from 'module';

// Provide CommonJS `require` in ESM runtime for bundled deps.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).require = require;

async function main() {
  await import('./init');
  await import('./instrument');
  await import('./endpoints');
  await import('./worker');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
