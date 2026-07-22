import type { SkillDestination, SkillDestinationSync } from '@metorial/db';

export type SkillDestinationSyncStatus = 'pending' | 'processing' | 'synced';

export let skillDestinationSyncStatusPresenter = (
  destination:
    | (Pick<SkillDestination, 'isDirty' | 'mustFlushAt'> & {
        syncs: Pick<SkillDestinationSync, 'status'>[];
      })
    | null
    | undefined
): SkillDestinationSyncStatus => {
  if (destination?.mustFlushAt || destination?.isDirty) return 'pending';
  if (
    destination?.syncs.filter(s => s.status === 'pending' || s.status === 'processing').length
  )
    return 'processing';
  return 'synced';
};
