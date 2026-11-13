import { rebuildOrganizationsManyQueue } from '../queues/rebuild';
import { redisKey } from '@mtsrc/agent-tracking-redis';
import { currentVersions, type RebuildImpact } from '@mtsrc/agent-tracking-layers';

export let versionRebuildGuardKey = () =>
  redisKey(
    'rebuild',
    'versions',
    `${currentVersions.summary}.${currentVersions.attribution}.${currentVersions.facts}`
  );

export let startVersionRebuilds = async () => {
  await rebuildOrganizationsManyQueue.add({ trigger: { type: 'version' } });
};

export let startCatalogRebuild = async (d: { impacts: RebuildImpact[] }) => {
  if (!d.impacts.length) return;

  await rebuildOrganizationsManyQueue.add({
    trigger: { type: 'catalog', impacts: d.impacts }
  });
};
