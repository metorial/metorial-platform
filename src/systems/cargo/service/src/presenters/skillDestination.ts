import type { SkillDestination, SkillDestinationSync } from '@metorial-cargo/db';

export type SkillDestinationSyncStatus = 'pending' | 'processing' | 'synced';

export let skillDestinationSyncStatusPresenter = (
  destination: Pick<SkillDestination, 'isDirty' | 'mustFlushAt'> & {
    syncs: Pick<SkillDestinationSync, 'status'>[];
  }
): SkillDestinationSyncStatus => {
  if (destination.mustFlushAt || destination.isDirty) return 'pending';
  if (destination.syncs.length > 0) return 'processing';
  return 'synced';
};
