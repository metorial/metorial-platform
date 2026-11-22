import { createRequire } from 'module';

// Provide CommonJS `require` in ESM runtime for bundled deps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).require = createRequire(import.meta.url);

async function main() {
  await import('./init');
  await import('./instrument');
  await import('./listeners');
  await import('./stages');

  let { env } = await import('./env');
  let roles = new Set(env.process.roles);
  if (!roles.size) throw new Error('AGENT_TRACKING_ROLES names no role to run');

  console.log(`Agent tracking roles: ${[...roles].join(', ')}`);

  let { getSentry } = await import('@lowerdeck/sentry');
  getSentry().setTag('roles', [...roles].join(','));

  let { setStoreIndexMode } = await import('@mtsrc/agent-tracking-store');
  setStoreIndexMode(roles.has('worker') ? 'background' : 'skip');

  if (roles.has('api')) await import('./api');
  if (roles.has('ingest')) await import('./ingest');

  let { startHealthServer } = await import('./health');
  startHealthServer(roles);

  if (roles.has('worker')) await import('./worker');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

if (process.env.HEARTBEAT_URL) {
  setInterval(() => {
    fetch(process.env.HEARTBEAT_URL!, { method: 'POST' }).catch(error => {
      console.error('Failed to send heartbeat:', error);
    });
  }, 45 * 1000);
}
