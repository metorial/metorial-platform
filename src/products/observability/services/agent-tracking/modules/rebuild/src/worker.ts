import { tryRedis } from '@mtsrc/agent-tracking-redis';
import { startVersionRebuilds, versionRebuildGuardKey } from './lib/triggers';

// Every worker calls this on startup; the key holds the version tuple, so the rebuild starts
// once per release that bumps a derivation version, not once per worker.
export let onRebuildWorkerStart = async () => {
  let claimed = await tryRedis(
    async redis =>
      (await redis.set(versionRebuildGuardKey(), new Date().toISOString(), 'NX')) == 'OK'
  );
  if (!claimed) return false;

  await startVersionRebuilds();

  return true;
};
