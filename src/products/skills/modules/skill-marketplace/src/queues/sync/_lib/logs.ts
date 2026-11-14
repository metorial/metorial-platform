import { db } from '@metorial/db';

export type SkillDestinationSyncLogEntry = [number, string];

export let appendSkillDestinationSyncLog = async (
  skillDestinationSyncId: string,
  message: string
) => {
  await db.skillDestinationSync.updateMany({
    where: { id: skillDestinationSyncId },
    data: {
      logs: {
        push: [Date.now(), message] satisfies SkillDestinationSyncLogEntry
      }
    }
  });
};
