import { rebuildOrganizationsManyQueue } from '../queues/rebuild';
import { tryRedis } from '../sessions/redis';
import { currentVersions } from './plan';

export let versionRebuildGuardKey = () =>
  `gs:rebuild:versions:${currentVersions.summary}.${currentVersions.attribution}.${currentVersions.facts}`;

export let startVersionRebuilds = async () => {
  await rebuildOrganizationsManyQueue.add({ trigger: { type: 'version' } });
};

export let startCatalogRebuild = async (d: { from: Date; to: Date }) => {
  await rebuildOrganizationsManyQueue.add({
    trigger: { type: 'catalog', from: d.from.toISOString(), to: d.to.toISOString() }
  });
};

// Every worker calls this on startup; the key holds the version tuple, so the rebuild starts
// once per release that bumps a derivation version, not once per worker.
export let startVersionRebuildsOnce = async () => {
  let claimed = await tryRedis(
    async redis =>
      (await redis.set(versionRebuildGuardKey(), new Date().toISOString(), 'NX')) == 'OK'
  );
  if (!claimed) return false;

  await startVersionRebuilds();

  return true;
};
