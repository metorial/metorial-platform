import type { Instance, SkillDestinationStorageMode } from '@metorial/db';
import { flagService } from '@metorial/module-flags';

export let getNewSkillDestinationStorageMode = async (d: {
  instance: Pick<Instance, 'oid'>;
}): Promise<SkillDestinationStorageMode> =>
  (await flagService.isFlagEnabledForInstance({
    instance: d.instance,
    flag: 'skills-manifest-sync'
  }))
    ? 'manifest'
    : 'code_bucket';
