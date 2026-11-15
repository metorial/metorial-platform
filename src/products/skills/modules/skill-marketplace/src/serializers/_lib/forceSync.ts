import type { SkillMarketplace } from '@metorial/db';

export let getMarketplaceForceSyncHashInput = (
  skillMarketplace?: Pick<SkillMarketplace, 'forceSyncCounter'>
) =>
  skillMarketplace && skillMarketplace.forceSyncCounter > 0
    ? { marketplaceForceSyncCounter: skillMarketplace.forceSyncCounter }
    : {};
